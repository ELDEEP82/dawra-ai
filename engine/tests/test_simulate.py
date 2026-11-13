"""Integration tests: calibration, holdout and the farmer's current rotation."""
import numpy as np
import pytest

from dawra.calibration import build_engine, default_farm
from dawra.simulate import FALLOW, parts_of, simulate, structure_violations


@pytest.fixture(scope="module")
def eng_info():
    return build_engine()


def test_barley_calibration_reproduces_s1(eng_info):
    eng, info = eng_info
    c = info["calibration"]["barley"]["calibration"]
    assert c.observed_kg_ha == 4215
    modelled = c.ymax_kg_ha * c.rel_yield_pct / 100 * c.heat_factor
    assert modelled == pytest.approx(4215, rel=1e-6)
    assert eng.crops["barley"].ymax == pytest.approx(c.ymax_kg_ha)


def test_ece_ratio_calibrated_to_s4(eng_info):
    _, info = eng_info
    assert info["ece_check"].modelled == pytest.approx(8.56)
    assert info["ecw_s4"] == 7.94


def test_wheat_holdout_reported(eng_info):
    _, info = eng_info
    h = info["holdout"]
    assert h["ecw"] == pytest.approx(5000 / 640)
    assert np.isfinite(h["per_feddan"].error_pct)


def test_current_rotation_runs(eng_info):
    eng, _ = eng_info
    farm = default_farm()
    plan = ("barley", FALLOW) * 3
    r = simulate(plan, farm, eng)
    assert len(r.slots) == 6 and len(r.trajectory) == 7
    assert float(r.water_m3[0]) > 0
    assert 0 < r.slots[0].area_fdn <= farm.area_fdn
    assert structure_violations(plan, eng.crops) == {"wrong_slot": 0, "broken_perennial": 0, "overlap_days": 0.0,
                                                    "family_run": 0.0}


def test_perennial_parts_and_constraints(eng_info):
    eng, _ = eng_info
    plan = ("alfalfa", "alfalfa", "barley", FALLOW, "wheat", "sorghum")
    assert parts_of(plan, eng.crops)[:2] == [("alfalfa", 0), ("alfalfa", 1)]
    assert structure_violations(plan, eng.crops)["broken_perennial"] == 0
    bad = ("barley", "barley", "wheat", FALLOW, "wheat", FALLOW)
    assert structure_violations(bad, eng.crops)["wrong_slot"] == 1
    run = ("barley", "sorghum", "wheat", FALLOW, "barley", FALLOW)
    assert structure_violations(run, eng.crops)["family_run"] == 1


def test_scenario_mode_vectorised(eng_info):
    eng, _ = eng_info
    farm = default_farm()
    years = np.array([[2000, 2001, 2001, 2002, 2002, 2003], [2010, 2011, 2011, 2012, 2012, 2013]])
    r = simulate(("barley", "sorghum") * 3, farm, eng, years=years)
    assert r.water_m3.shape == (2,) and np.all(np.isfinite(r.water_m3))


def test_higher_ecw_hurts(eng_info):
    eng, _ = eng_info
    plan = ("wheat", FALLOW) * 3
    lo = simulate(plan, default_farm(ecw=5.0), eng)
    hi = simulate(plan, default_farm(ecw=12.0), eng)
    # saltier water needs more leaching water per feddan -> fewer feddan irrigable -> less output
    assert hi.slots[0].area_fdn < lo.slots[0].area_fdn
    assert float(hi.productivity[0]) < float(lo.productivity[0])
    assert float(hi.end.ece[0]) > float(lo.end.ece[0])
