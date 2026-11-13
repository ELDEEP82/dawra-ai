"""±20 % one-at-a-time sensitivity on every numeric assumption (Prompt 8).

For speed the candidate set is fixed: the baseline NSGA-II Pareto front + the current rotation.
Under each perturbation the engine is rebuilt (crops, climate bank, calibration), every candidate
is re-simulated, and the four picks are recomputed. Reported per assumption: whether any pick
changes (ranking flip) and the % change of the balanced compromise's output index and water.
"""
from __future__ import annotations

import json
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import pandas as pd

from . import assumptions as A
from . import optimizer as O
from .calibration import build_engine, climate_daily, default_farm
from .config import PROCESSED, REPORTS
from .crop_params import build_crops
from .data_io import load_farmer_profiles
from .reporting import md_table, new_fig, save_fig

SKIP_PREFIX = ("opt.pop", "opt.gen", "opt.seed", "st.n_boot", "st.seed", "clim.normal", "clim.ang_", "clim.krs",
               "clim.heat_report", "st.")  # run-control / reporting-only / stress-only values
KINDS = ("max_profit", "min_water", "best_soil", "compromise")


def candidate_ids() -> list[str]:
    """Numeric, non-zero assumptions that influence the plan ranking."""
    return [i for i in A.numeric_ids() if not i.startswith(SKIP_PREFIX)]


def evaluate(plans: list[tuple[str, ...]], overrides: dict[str, float] | None = None) -> dict:
    """Picks and compromise metrics for a fixed candidate set under optional overrides."""
    with A.override(overrides or {}):
        build_crops.cache_clear()
        climate_daily.cache_clear()
        eng, _ = build_engine()
        farm = default_farm()
        ev = O.Evaluator(eng, farm)
        cur = ev(O.current_plan(farm.last_crop))
        items = [ev(p) for p in plans]
        front = O.pareto_filter([e for e in items if e.feasible]) or [cur]
        picks = O.pick_extremes(front, cur)
        w = load_farmer_profiles()["balanced"].to_dict()
        w["risk_climate"] = 0.0  # robustness not recomputed per perturbation
        comp, _ = O.compromise(front, w)
        out = {k: list(e.plan) for k, e in picks.items()}
        out["compromise"] = list(comp.plan)
        out["comp_value"] = comp.value
        out["comp_water"] = comp.water_m3
        out["cur_value"] = cur.value
    build_crops.cache_clear()
    climate_daily.cache_clear()
    return out


def _job(args):
    aid, factor, plans = args
    base = A.get(aid)
    return aid, factor, evaluate(plans, {aid: base * factor})


def run(workers: int = 6) -> pd.DataFrame:
    """Run the full ±20 % sweep; returns one row per assumption."""
    eng, _ = build_engine()
    front, ev = O.run(eng, default_farm())
    plans = [e.plan for e in front]
    base = evaluate(plans)
    ids = candidate_ids()
    jobs = [(i, f, plans) for i in ids for f in (0.8, 1.2)]
    res: dict[str, dict] = {}
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for aid, f, out in pool.map(_job, jobs, chunksize=2):
            res.setdefault(aid, {})[f] = out
    rows = []
    for aid in ids:
        lo, hi = res[aid][0.8], res[aid][1.2]
        flips = sorted({k for k in KINDS for r in (lo, hi) if r[k] != base[k]})
        rows.append({
            "id": aid, "base_value": A.get(aid),
            "comp_value_-20%": (lo["comp_value"] / base["comp_value"] - 1) * 100,
            "comp_value_+20%": (hi["comp_value"] / base["comp_value"] - 1) * 100,
            "comp_water_-20%": (lo["comp_water"] / base["comp_water"] - 1) * 100,
            "comp_water_+20%": (hi["comp_water"] / base["comp_water"] - 1) * 100,
            "picks_changed": ", ".join(flips) if flips else "",
        })
    df = pd.DataFrame(rows)
    df["swing"] = df[["comp_value_-20%", "comp_value_+20%", "comp_water_-20%", "comp_water_+20%"]].abs().max(axis=1)
    df = df.sort_values("swing", ascending=False)
    df.to_csv(PROCESSED / "sensitivity.csv", index=False)
    (PROCESSED / "sensitivity_base.json").write_text(json.dumps(base, indent=1), encoding="utf-8")
    return df


def write_report(df: pd.DataFrame | None = None) -> str:
    """Tornado chart + table → reports/08_sensitivity.md."""
    df = pd.read_csv(PROCESSED / "sensitivity.csv") if df is None else df
    df["picks_changed"] = df["picks_changed"].fillna("")
    df["base_value"] = df["base_value"].map(lambda v: f"{v:g}")
    top = df.head(15).iloc[::-1]
    fig, ax = new_fig(8, 5.5)
    y = np.arange(len(top))
    ax.barh(y - 0.2, top["comp_water_-20%"], 0.4, color="#3987e5", label="water, −20 % assumption")
    ax.barh(y + 0.2, top["comp_water_+20%"], 0.4, color="#d95926", label="water, +20 % assumption")
    ax.set_yticks(y, top["id"], fontsize=8)
    ax.axvline(0, color="#888", lw=0.8)
    ax.set_xlabel("% change in the balanced plan's 3-year water use")
    ax.set_title("Tornado — top 15 assumptions (±20 %, one at a time)")
    ax.legend(fontsize=8)
    fig_path = save_fig(fig, "08_tornado.png")
    flips = df[df["picks_changed"] != ""]
    n = len(df)
    md = [
        "# 08 — Sensitivity (±20 % on each assumption)", "",
        f"{n} numeric assumptions from `data/assumptions.csv` were varied by −20 % and +20 %, one at a time "
        f"({2 * n} engine rebuilds incl. calibration). Candidate plans = the baseline NSGA-II front for F001 "
        "(ECw 8.35, 60 m³/day) + the current rotation; picks recomputed each time (balanced weights, risk weight "
        "set to 0 because robustness is not re-run per perturbation). Run-control values (population, seeds, "
        "bootstrap size, stress-only thresholds) are excluded.", "",
        f"![tornado]({fig_path.as_posix()})", "",
        f"**Assumptions that change at least one pick: {len(flips)} of {n}.**", "",
        md_table(flips[["id", "base_value", "picks_changed", "comp_value_-20%", "comp_value_+20%",
                        "comp_water_-20%", "comp_water_+20%"]], "{:+.1f}") if len(flips) else "None.", "",
        "## Top 15 by swing", "",
        md_table(df.head(15)[["id", "base_value", "comp_value_-20%", "comp_value_+20%", "comp_water_-20%",
                              "comp_water_+20%", "picks_changed"]], "{:+.1f}"), "",
        "Reading: the plan ranking is most sensitive to the FAO-56 stage-length fractions and drip efficiency "
        "(they set peak demand, hence how many feddan the well can water), to quinoa's Kc (quinoa is a FAO-56 gap), "
        "to the S4-based ECe calibration (`soil.lf_cal`) and to the planning rule 'at least 3 cropped seasons'. "
        "Prices, once available, will add another first-order driver. Picks are robust to the residue-carbon, "
        "nitrogen, effective-rain and most heat thresholds.", "",
        "Full table: `data/processed/sensitivity.csv`.",
    ]
    text = "\n".join(md)
    (REPORTS / "08_sensitivity.md").write_text(text, encoding="utf-8")
    return text


if __name__ == "__main__":
    write_report(run())
