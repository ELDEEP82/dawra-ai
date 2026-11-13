"""Tests for M6 optimizer: decoding, TOPSIS, Pareto filter, picks, and a short NSGA-II run."""
import numpy as np
import pytest

from dawra import optimizer as O
from dawra.calibration import build_engine, default_farm
from dawra.simulate import FALLOW


@pytest.fixture(scope="module")
def setup():
    eng, _ = build_engine()
    return eng, default_farm()


def test_domains_respect_avoid_and_slots(setup):
    eng, farm = setup
    dom = O.domains(eng, farm)
    assert "tomato" not in dom["W"] and "barley" in dom["W"] and "sorghum" in dom["S"]
    assert dom["W"][0] == FALLOW and dom["S"][0] == FALLOW
    assert "alfalfa" in dom["W"] and "bermuda" in dom["S"]


def test_decode_perennial_continuation(setup):
    eng, farm = setup
    dom = O.domains(eng, farm)
    x = np.array([dom["W"].index("alfalfa"), 0, dom["W"].index("barley"), 0, 0, 0])
    plan = O.decode(x, dom, eng.crops)
    assert plan[:3] == ("alfalfa", "alfalfa", "barley")


def test_topsis_hand_example():
    # two criteria, equal weights: row 0 best on both -> closeness 1
    m = np.array([[10.0, 1.0], [5.0, 2.0], [1.0, 3.0]])
    s = O.topsis(m, np.array([0.5, 0.5]), np.array([True, False]))
    assert s[0] == pytest.approx(1.0) and s[2] == pytest.approx(0.0) and 0 < s[1] < 1


def test_current_rotation_feasible_and_baseline(setup):
    eng, farm = setup
    ev = O.Evaluator(eng, farm)
    cur = ev(O.current_plan(farm.last_crop))
    assert cur.plan == ("barley", FALLOW) * 3 and cur.feasible and cur.value > 0


def test_short_run_returns_feasible_front(setup):
    eng, farm = setup
    front, ev = O.run(eng, farm, pop=30, gen=8, seed=1)
    assert front and all(e.feasible for e in front)
    assert all(c not in farm.avoid for e in front for c in e.plan)
    cur = ev(O.current_plan(farm.last_crop))
    picks = O.pick_extremes(front, cur)
    assert set(picks) == {"max_profit", "min_water", "best_soil"}
    assert picks["max_profit"].value >= max(e.value for e in front) - 1e-12
    w = {c: 1 / 6 for c in O.CRITERIA}
    best, score = O.compromise(front, w)
    assert best in front and len(score) == len(front)


def test_area_genes_decode_and_cap(setup):
    eng, farm = setup
    dom = O.domains(eng, farm)
    x = np.array([dom["W"].index("barley"), 0, dom["W"].index("barley"), 0, 0, 0, 9, 4, 0, 9, 9, 9])
    plan, areas = O.decode_full(x, dom, eng.crops)
    assert areas[1] == 0.0 and areas[0] == 1.0 and areas[2] == 0.1  # fallow → 0
    ev = O.Evaluator(eng, farm)
    full = ev(plan, areas)
    assert full.sim.slots[0].area_fdn <= eng.area_limit("barley", farm, farm.ecw) + 1e-9  # well cap
    assert full.sim.slots[2].area_fdn == pytest.approx(0.1 * farm.area_fdn)
    assert full.kg_per_m3 > 0


def test_pareto_filter_removes_dominated(setup):
    eng, farm = setup
    ev = O.Evaluator(eng, farm)
    a = ev(("barley", FALLOW) * 3)
    b = ev(("barley", FALLOW, "barley", FALLOW, FALLOW, FALLOW))
    front = O.pareto_filter([a, b])
    assert a in front  # b has less value; may or may not be dominated on water
    assert all(isinstance(e, O.Evaluated) for e in front)
