"""M6 — multi-objective rotation optimiser (pymoo NSGA-II) + TOPSIS compromise + current-rotation baseline.

Objectives: maximise profit (or the relative productivity index while prices are pending),
minimise gross water (m³ / 3 years), maximise the soil health index.
Constraints: crop sown in its season, perennials kept whole, no >2 consecutive seasons of one
family, no harmful sowing overlap, ≥ opt.min_rel_yield % relative yield for every crop at the
farm ECw, ≥ opt.min_cropped_slots cropped seasons, avoided crops excluded from the gene domain.
Peak water ≤ well capacity holds by construction (planted area is water-limited, D14).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import ElementwiseProblem
from pymoo.operators.crossover.sbx import SBX
from pymoo.operators.mutation.pm import PM
from pymoo.operators.repair.rounding import RoundingRepair
from pymoo.operators.sampling.rnd import IntegerRandomSampling
from pymoo.optimize import minimize

from . import assumptions as A
from .simulate import (FALLOW, SLOT_TYPE, Engine, Farm, SimResult, market_score, min_rel_yield, simulate,
                       structure_violations)

CRITERIA = ("profit", "water_saving", "salt_tolerance", "soil_health", "market_demand", "risk_climate")


@dataclass
class Evaluated:
    """A plan with its typical-climate metrics."""

    plan: tuple[str, ...]
    sim: SimResult
    value: float  # profit EGP if prices complete, else productivity index
    water_m3: float
    soil_index: float
    min_ry: float
    market: float
    violations: dict[str, float]
    risk: float | None = None

    @property
    def feasible(self) -> bool:
        """True if every constraint is satisfied."""
        return all(v <= 1e-9 for v in self.violations.values())


def current_plan(last_crop: str) -> tuple[str, ...]:
    """Farmer's current rotation: ``last_crop`` in winter, fallow in summer, three times."""
    return (last_crop, FALLOW) * 3


def domains(eng: Engine, farm: Farm) -> dict[str, list[str]]:
    """Gene domain per slot type: crops sown in that slot (minus avoided) + fallow."""
    out: dict[str, list[str]] = {"W": [FALLOW], "S": [FALLOW]}
    for cid, c in eng.crops.items():
        if cid in farm.avoid or cid in ("date_palm", "olive"):
            continue
        out[c.slot].append(cid)
    return out


def decode(x: np.ndarray, dom: dict[str, list[str]], crops) -> tuple[str, ...]:
    """Integer genes → plan; the slot after a perennial's sowing slot becomes its continuation."""
    plan: list[str] = []
    for i, g in enumerate(x):
        if i > 0 and plan[i - 1] != FALLOW and crops[plan[i - 1]].perennial and (i < 2 or plan[i - 2] != plan[i - 1]):
            plan.append(plan[i - 1])
            continue
        opts = dom[SLOT_TYPE[i]]
        plan.append(opts[int(g) % len(opts)])
    return tuple(plan)


class Evaluator:
    """Memoised plan evaluation for one farm configuration."""

    def __init__(self, eng: Engine, farm: Farm):
        self.eng, self.farm = eng, farm
        self.cache: dict[tuple[str, ...], Evaluated] = {}

    def __call__(self, plan: tuple[str, ...]) -> Evaluated:
        if plan not in self.cache:
            sim = simulate(plan, self.farm, self.eng)
            v = structure_violations(plan, self.eng.crops)
            mry = min_rel_yield(sim)
            n_crop = sum(1 for c in plan if c != FALLOW)
            v["min_yield"] = max(0.0, A.get("opt.min_rel_yield") - mry) if n_crop else 0.0
            v["cropped"] = max(0.0, A.get("opt.min_cropped_slots") - n_crop)
            value = float(sim.profit_egp[0]) if sim.profit_egp is not None else float(sim.productivity[0])
            self.cache[plan] = Evaluated(plan, sim, value, float(sim.water_m3[0]), float(sim.soil_index[0]), mry,
                                         market_score(plan, self.farm, self.eng.crops), v)
        return self.cache[plan]


class RotationProblem(ElementwiseProblem):
    """pymoo problem: 6 integer genes, 3 objectives, 6 constraints."""

    def __init__(self, ev: Evaluator, dom: dict[str, list[str]]):
        self.ev, self.dom = ev, dom
        xu = np.array([len(dom[t]) - 1 for t in SLOT_TYPE])
        super().__init__(n_var=6, n_obj=3, n_ieq_constr=6, xl=np.zeros(6), xu=xu, vtype=int)

    def _evaluate(self, x, out, *args, **kwargs):
        e = self.ev(decode(np.round(x).astype(int), self.dom, self.ev.eng.crops))
        out["F"] = [-e.value, e.water_m3, -e.soil_index]
        v = e.violations
        out["G"] = [v["wrong_slot"], v["broken_perennial"], v["overlap_days"], v["family_run"], v["min_yield"],
                    v["cropped"]]


def run(eng: Engine, farm: Farm, pop: int | None = None, gen: int | None = None, seed: int | None = None,
        ) -> tuple[list[Evaluated], Evaluator]:
    """Run NSGA-II; return the feasible, de-duplicated Pareto set and the evaluator (with its cache)."""
    ev = Evaluator(eng, farm)
    dom = domains(eng, farm)
    prob = RotationProblem(ev, dom)
    algo = NSGA2(
        pop_size=pop or int(A.get("opt.pop")), sampling=IntegerRandomSampling(),
        crossover=SBX(prob=0.9, eta=15, vtype=float, repair=RoundingRepair()),
        mutation=PM(eta=20, vtype=float, repair=RoundingRepair()), eliminate_duplicates=True,
    )
    res = minimize(prob, algo, ("n_gen", gen or int(A.get("opt.gen"))), seed=seed or int(A.get("opt.seed")),
                   verbose=False)
    plans = {decode(np.round(x).astype(int), dom, eng.crops) for x in np.atleast_2d(res.X)} if res.X is not None else set()
    front = [ev(p) for p in plans if ev(p).feasible]
    return pareto_filter(front), ev


def pareto_filter(items: list[Evaluated]) -> list[Evaluated]:
    """Non-dominated subset on (value ↑, water ↓, soil ↑)."""
    keep = []
    for a in items:
        dominated = any(
            (b.value >= a.value and b.water_m3 <= a.water_m3 and b.soil_index >= a.soil_index)
            and (b.value > a.value or b.water_m3 < a.water_m3 or b.soil_index > a.soil_index)
            for b in items
        )
        if not dominated:
            keep.append(a)
    return sorted(keep, key=lambda e: -e.value)


def pick_extremes(front: list[Evaluated], current: Evaluated) -> dict[str, Evaluated]:
    """max_profit, min_water and best_soil picks (the last two keep ≥ guard × current value)."""
    guard = A.get("opt.guard_productivity") * current.value
    ok = [e for e in front if e.value >= guard] or front
    return {
        "max_profit": max(front, key=lambda e: (e.value, -e.water_m3)),
        "min_water": min(ok, key=lambda e: (e.water_m3, -e.value)),
        "best_soil": max(ok, key=lambda e: (e.soil_index, e.value)),
    }


def criteria_matrix(items: list[Evaluated]) -> np.ndarray:
    """Rows = plans, columns = CRITERIA (water as a cost, others as benefits)."""
    return np.array([[e.value, e.water_m3, e.min_ry, e.soil_index, e.market, e.risk or 0.0] for e in items], float)


def topsis(matrix: np.ndarray, weights: np.ndarray, benefit: np.ndarray) -> np.ndarray:
    """TOPSIS closeness (0–1) per row; vector normalisation, ideal/anti-ideal by benefit/cost."""
    norm = np.linalg.norm(matrix, axis=0)
    norm[norm == 0] = 1.0
    v = matrix / norm * weights
    ideal = np.where(benefit, v.max(axis=0), v.min(axis=0))
    anti = np.where(benefit, v.min(axis=0), v.max(axis=0))
    d_pos = np.linalg.norm(v - ideal, axis=1)
    d_neg = np.linalg.norm(v - anti, axis=1)
    den = d_pos + d_neg
    return np.where(den > 0, d_neg / np.where(den > 0, den, 1), 0.0)


def compromise(front: list[Evaluated], weights: dict[str, float]) -> tuple[Evaluated, np.ndarray]:
    """TOPSIS compromise for a priority profile (weights keyed by CRITERIA)."""
    w = np.array([weights.get(c, 0.0) for c in CRITERIA], float)
    benefit = np.array([True, False, True, True, True, True])
    score = topsis(criteria_matrix(front), w, benefit)
    return front[int(np.argmax(score))], score


def attach_risk(items: list[Evaluated], risk_fn: Callable[[tuple[str, ...]], float]) -> None:
    """Fill ``risk`` (robustness 0–1) for each plan, memoised by plan."""
    memo: dict[tuple[str, ...], float] = {}
    for e in items:
        if e.plan not in memo:
            memo[e.plan] = risk_fn(e.plan)
        e.risk = memo[e.plan]
