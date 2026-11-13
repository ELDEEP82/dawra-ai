"""Tests for M7: scenarios, bootstrap, robustness, what-if grid and explanation cards."""
import numpy as np
import pytest

from dawra import stress as S
from dawra.calibration import build_engine, default_farm
from dawra.context import card_context
from dawra.explain import card, llm_polish, numbers_in
from dawra.export import plan_json
from dawra.optimizer import Evaluator, current_plan
from dawra.simulate import FALLOW


@pytest.fixture(scope="module")
def setup():
    eng, _ = build_engine()
    return eng, default_farm()


def test_scenario_families():
    keys = [s.key for s in S.scenario_families()]
    assert keys == ["historical", "warm1", "warm2", "dry10", "dry20", "ecw1", "ecw2"]
    fam = {s.key: s for s in S.scenario_families()}
    assert fam["warm1"].d_t == 1.0 and fam["dry20"].rain_scale == pytest.approx(0.8) and fam["ecw2"].d_ecw == 2


def test_bootstrap_shape_and_pairing(setup):
    eng, _ = setup
    starts = S.valid_start_years(eng)
    assert starts.min() == 1981 and len(starts) > 40
    y = S.bootstrap_years(starts, 50, 3)
    assert y.shape == (50, 6)
    assert np.all(y[:, 1] == y[:, 0] + 1) and np.all(y[:, 3] == y[:, 2] + 1)
    assert np.array_equal(y, S.bootstrap_years(starts, 50, 3))  # seeded


def test_robustness_summary(setup):
    eng, farm = setup
    r = S.robustness(current_plan("barley"), farm, eng, n=40)
    assert 0 <= r["robustness_pct"] <= 100 and r["n_draws"] == 40 * 7
    assert {b["key"] for b in r["by_scenario"]} >= {"historical", "warm2", "ecw2"}
    assert r["cmip6"] == "pending"


def test_saltier_well_never_helps_robustness_of_salt_balance(setup):
    eng, farm = setup
    plan = current_plan("barley")
    a = S.scenario_slider(plan, farm, eng, 0, 0, 0)
    b = S.scenario_slider(plan, farm, eng, 0, 0, 3)
    assert b["water_m3"] >= a["water_m3"] * 0.95  # more leaching water needed (capped by the well)
    assert len(a["rel_yield"]) == 6 and a["rel_yield"][1] is None


def test_warming_increases_water(setup):
    eng, farm = setup
    plan = ("barley", "sorghum") * 3
    a = S.scenario_slider(plan, farm, eng, 0, 0, 0)
    b = S.scenario_slider(plan, farm, eng, 3, 0, 0)
    assert b["water_m3"] > a["water_m3"]


def _plans(setup):
    eng, farm = setup
    ev = Evaluator(eng, farm)
    cur = ev(current_plan("barley"))
    alt = ev(("barley", "sorghum", "faba_bean", FALLOW, "barley_forage", "cowpea"))
    pc = plan_json(cur, "current", eng, farm, cur, False)
    pa = plan_json(alt, "max_profit", eng, farm, cur, False)
    pa["robustness"] = S.robustness(alt.plan, farm, eng, n=30)
    ctx = card_context(eng, farm.ecw, "balanced", {"profit": .25, "water_saving": .25, "salt_tolerance": .2,
                                                   "soil_health": .15, "market_demand": .1, "risk_climate": .05},
                       120, True, "pending")
    return pc, pa, ctx


def test_card_has_five_fields_both_languages(setup):
    pc, pa, ctx = _plans(setup)
    c = card(pa, pc, ctx)
    for lang in ("en", "ar"):
        assert set(c[lang]) == {"why", "evidence", "benefits", "gaps", "risks"}
        assert all(c[lang][k] for k in c[lang])
    assert len(c["en"]["why"]) == len(c["ar"]["why"])
    assert any("NASA POWER" in s for s in c["en"]["evidence"])
    assert any("prices" in s for s in c["en"]["gaps"])
    assert c["en"]["risks"][-1].startswith("Decision support only")


def test_card_numbers_come_from_plan(setup):
    pc, pa, ctx = _plans(setup)
    c = card(pa, pc, ctx)
    text = " ".join(c["en"]["why"])
    assert f"{pa['totals']['value']:.2f}" in text and f"{pc['totals']['value']:.2f}" in text


def test_llm_polish_guard():
    t = "Saves 31% water (1,200 vs 1,740 m³)."
    assert llm_polish(t) == t
    assert llm_polish(t, lambda s: s.replace("Saves", "Uses")) .startswith("Uses")
    with pytest.raises(ValueError):
        llm_polish(t, lambda s: s.replace("31", "35"))
    assert numbers_in("a 1,200 b 3.5") == ["1200", "3.5"]
