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
    keys = [s.key for s in S.scenario_families(include_cmip=False)]
    assert keys == ["historical", "warm1", "warm2", "dry10", "dry20", "ecw1", "ecw2"]
    cm = [s for s in S.scenario_families() if s.cmip]
    assert all(s.key.startswith("cmip_") for s in cm)
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
    n_fam = len(S.scenario_families())
    assert 0 <= r["robustness_pct"] <= 100 and r["n_draws"] == 40 * n_fam * 3
    assert {b["key"] for b in r["by_scenario"]} >= {"historical", "warm2", "ecw2"}
    assert [b["leach_pct"] for b in r["by_leaching"]] == [100, 70, 40]
    assert r["cmip6"] in ("pending", "included")
    assert set(r["bands"]) == {"product_t", "profit_egp", "ece_end"}
    assert r["bands"]["ece_end"]["p10"] <= r["bands"]["ece_end"]["p50"] <= r["bands"]["ece_end"]["p90"]


def test_less_leaching_means_more_salt(setup):
    eng, farm = setup
    r = S.robustness(current_plan("barley"), farm, eng, n=40)
    lv = {b["leach_pct"]: b for b in r["by_leaching"]}
    assert lv[40]["salt_buildup_pct"] >= lv[100]["salt_buildup_pct"]
    assert lv[40]["pass_pct"] <= lv[100]["pass_pct"]


def test_saltier_well_never_helps_robustness_of_salt_balance(setup):
    eng, farm = setup
    plan = current_plan("barley")
    a = S.scenario_slider(plan, farm, eng, 0, 0, 0)
    b = S.scenario_slider(plan, farm, eng, 0, 0, 3)
    col = {c: i for i, c in enumerate(S.WHATIF_COLS)}
    assert b[col["water_m3"]] >= a[col["water_m3"]] * 0.95  # more leaching water needed (capped by the well)
    assert len(a) == len(S.WHATIF_COLS) and a[col["y2"]] is None


def test_warming_increases_water(setup):
    eng, farm = setup
    plan = ("barley", "sorghum") * 3
    a = S.scenario_slider(plan, farm, eng, 0, 0, 0)
    b = S.scenario_slider(plan, farm, eng, 3, 0, 0)
    i = S.WHATIF_COLS.index("water_m3")
    assert b[i] > a[i]


def test_whatif_grid_shape(setup):
    eng, farm = setup
    g = S.whatif_grid(current_plan("barley"), farm, eng)
    assert len(g["rows"]) == 7 * 4 * 4 * 3 and g["cols"] == list(S.WHATIF_COLS)


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
