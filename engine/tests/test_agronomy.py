"""Tests for M2 water_salt, M3 yield_model, M4 soil_twin and the plan simulator."""
import numpy as np
import pytest

from dawra import assumptions as A
from dawra.crop_params import build_crops, plan_crops
from dawra.soil_twin import SoilState, ece_calibration_factor, ece_steady, mix_ece, soil_health_index, step
from dawra.water_salt import (ece_ratio_fao29, gross_irrigation, kc_array, leaching_requirement,
                              mm_to_m3_per_feddan)
from dawra.yield_model import heat_factor, maas_hoffman


@pytest.fixture(scope="module")
def crops():
    return build_crops()


# ---------------------------------------------------------------- crops
def test_all_crops_complete(crops):
    assert len(crops) == 21
    for c in crops.values():
        assert c.ece50 > c.ece100 > 0
        assert all(k > 0 for k in c.kc) and c.root_m > 0
        assert abs(sum(c.stage_frac) - 1) < 1e-9


def test_rating_fallback_uses_class_median(crops):
    # MT crops with numbers: wheat 6/13, barley_forage 6/13, sorghum 6.8/9.9, sudan 2.8/14, cowpea 4.9/9.1, squash 4.7/10
    assert crops["triticale"].ece100 == pytest.approx(np.median([6, 6, 6.8, 2.8, 4.9, 4.7]))
    assert crops["quinoa"].salt_rating == "T"


def test_stage_split_parsed_from_sheet(crops):
    # sorghum "FAO-56 T11 arid region 20/35/45/30"
    assert crops["sorghum"].stage_frac == pytest.approx(tuple(np.array([20, 35, 45, 30]) / 130))


def test_plan_crops_excludes_trees_and_avoided():
    pc = plan_crops(("tomato",))
    assert "date_palm" not in pc and "olive" not in pc and "tomato" not in pc and "barley" in pc


# ---------------------------------------------------------------- water & salt
def test_kc_curve_shape(crops):
    k = kc_array(crops["barley"])
    assert len(k) == 150
    assert k[0] == pytest.approx(0.3) and k.max() == pytest.approx(1.15) and k[-1] == pytest.approx(0.25)


def test_leaching_requirement_hand_values():
    # barley ECe_t 8, ECw 8.35: 8.35 / (40 - 8.35) = 0.2638
    assert leaching_requirement(8.35, 8.0) == pytest.approx(0.2638, abs=1e-4)
    assert leaching_requirement(8.35, 1.5) == A.get("ws.lr_cap")  # impossible -> cap
    assert leaching_requirement(0.0, 5.0) == 0.0


def test_fao29_ratio_matches_rule_of_thumb():
    # FAO-29 LR equation inverted: LF 0.15 -> 1.533 (FAO-29 rule of thumb ≈ 1.5), LF 0.2 -> 1.2
    assert ece_ratio_fao29(0.15) == pytest.approx(1.5333, abs=1e-3)
    assert ece_ratio_fao29(0.2) == pytest.approx(1.2)


def test_gross_irrigation_and_units():
    g = gross_irrigation(400.0, 30.0, 0.2, 0.9)
    assert g == pytest.approx(370 / (0.9 * 0.8))
    assert mm_to_m3_per_feddan(10) == pytest.approx(42.0)


# ---------------------------------------------------------------- yield
def test_maas_hoffman_hand_values():
    # barley a=8, b=5: ECe 12.525 -> 77.4 % (Salinity_Yield sheet shows 77)
    assert maas_hoffman(12.525, 8, 5) == pytest.approx(77.375)
    assert maas_hoffman(3, 8, 5) == 100 and maas_hoffman(40, 8, 5) == 0


def test_salinity_sheet_reproduced(crops):
    """Salinity_Yield sheet: ECe = 1.5 × 8.35 → sorghum 8 %, cotton 74 %."""
    ece = 1.5 * 8.35
    for cid, expected in (("sorghum", 8), ("cotton", 74), ("wheat", 53), ("date_palm", 70)):
        c = crops[cid]
        assert round(maas_hoffman(ece, c.ece100, c.slope_b)) == expected


def test_heat_factor():
    assert heat_factor(0) == 1.0
    assert heat_factor(10) == pytest.approx(0.9)
    assert heat_factor(1000) == pytest.approx(1 - A.get("heat.max_penalty"))


# ---------------------------------------------------------------- soil twin
def test_ece_calibration_reproduces_s4():
    k = ece_calibration_factor(8.56, 7.94)
    assert ece_steady(7.94, A.get("soil.lf_cal"), k) == pytest.approx(8.56)


def test_mix_ece_limits():
    end, mean = mix_ece(10.0, 6.0, 0.0, 1.0, 0.16)
    assert end == pytest.approx(10.0) and mean == pytest.approx(10.0)
    end, mean = mix_ece(10.0, 6.0, 1e6, 1.0, 0.16)
    assert end == pytest.approx(6.0) and 6.0 <= mean <= 10.0


def test_fallow_raises_ece_and_legume_adds_n(crops):
    s0 = SoilState(ece=8.0, soc_pct=0.18, n_mg_kg=26.2)
    s1, _ = step(s0, None, 8.35, 0, 0, 0, 0.16, 0.7)
    assert s1.ece == pytest.approx(8.0 * (1 + A.get("soil.fallow_ece_rise")))
    s2, _ = step(s0, crops["cowpea"], 8.35, 0.3, 200, 1.0, 0.16, 0.7)
    assert s2.n_mg_kg > s0.n_mg_kg
    s3, _ = step(s0, crops["barley"], 8.35, 0.3, 200, 1.0, 0.16, 0.7)
    assert s3.n_mg_kg < s0.n_mg_kg and s3.soc_pct > 0


def test_pest_flag_after_three_same_family(crops):
    s = SoilState(ece=8.0, soc_pct=0.18, n_mg_kg=26.2)
    for _ in range(3):
        s, _ = step(s, crops["barley"], 8.35, 0.3, 200, 1.0, 0.16, 0.7)
    assert s.pest_flags == 1


def test_soil_index_neutral_and_direction():
    s = SoilState(ece=8.0, soc_pct=0.18, n_mg_kg=26.2)
    assert soil_health_index(s, s) == pytest.approx(50.0)
    better = SoilState(ece=6.0, soc_pct=0.2, n_mg_kg=30.0)
    assert soil_health_index(s, better) > 50
