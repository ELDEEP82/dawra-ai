"""Writes reports/05_optimizer.md and data/processed/plans_F001.json (Prompt 5)."""
from __future__ import annotations

import json

import pandas as pd

from . import optimizer as O
from .calibration import build_engine, default_farm
from .config import PROCESSED, REPORTS
from .data_io import load_farmer_profiles, prices_available
from .export import plan_json
from .reporting import md_table, new_fig, save_fig


def write_report() -> dict:
    """Run F001 (balanced profile), save JSON + markdown + Pareto PNG; return the JSON dict."""
    eng, _ = build_engine()
    farm = default_farm()
    front, ev = O.run(eng, farm)
    cur = ev(O.current_plan(farm.last_crop))
    picks = O.pick_extremes(front, cur)
    weights = load_farmer_profiles()["balanced"].to_dict()
    comp, _ = O.compromise(front, weights)
    priced = prices_available(eng.prices, list(eng.crops))
    chosen = {"current": cur, **picks, "compromise": comp}
    out = {"farm_id": farm.farm_id, "profile": "balanced", "prices_pending": not priced,
           "plans": [plan_json(e, k, eng, farm, cur, priced) for k, e in chosen.items()]}
    PROCESSED.mkdir(parents=True, exist_ok=True)
    (PROCESSED / "plans_F001.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    fig, ax = new_fig(7, 4.5)
    sc = ax.scatter([e.water_m3 for e in front], [e.value for e in front], c=[e.soil_index for e in front],
                    cmap="viridis", s=28)
    fig.colorbar(sc, ax=ax, label="soil health index")
    colors = {"current": "#e63946", "max_profit": "#f4a261", "min_water": "#219ebc", "best_soil": "#2a9d8f",
              "compromise": "#9b5de5"}
    for k, e in chosen.items():
        ax.scatter([e.water_m3], [e.value], s=140, facecolors="none", edgecolors=colors[k], linewidths=2.2, label=k)
    ax.set_xlabel("gross irrigation water, m³ per 3 years")
    ax.set_ylabel("relative productivity index" if not priced else "net profit EGP")
    ax.set_title(f"F001 Pareto front (NSGA-II, {len(front)} plans)")
    ax.legend(fontsize=8)
    fig_path = save_fig(fig, "05_pareto.png")

    rows = []
    for k, e in chosen.items():
        rows.append({"plan": k, "W1": e.plan[0], "S1": e.plan[1], "W2": e.plan[2], "S2": e.plan[3], "W3": e.plan[4],
                     "S3": e.plan[5], "value": e.value, "water_m3": e.water_m3, "soil_index": e.soil_index,
                     "min_RY_%": e.min_ry, "market": e.market})
    md = [
        "# 05 — Optimiser (M6, NSGA-II)", "",
        f"Farm F001 at ECw {farm.ecw} dS/m, {farm.water_m3_day:g} m³/day; population 120 × 200 generations, seed 42. "
        f"Feasible Pareto plans: **{len(front)}**; unique plans evaluated: {len(ev.cache):,}.", "",
        ("**Prices pending** — `data/prices_egp.csv` is blank, so the profit objective is the *relative productivity "
         "index* = Σ seasons (planted share of the farm × relative yield). It ranks plans by how much of the farm's "
         "potential output they deliver; it is not money.") if not priced else "Profit uses data/prices_egp.csv.", "",
        f"![pareto]({fig_path.as_posix()})", "",
        "## Current rotation vs the four picks (balanced profile for the compromise)", "",
        md_table(pd.DataFrame(rows), "{:.2f}"), "",
        "Picks: *max_profit* = highest value on the front; *min_water* and *best_soil* = lowest water / highest soil "
        "index among plans keeping ≥ 80 % of the current rotation's value (`opt.guard_productivity`); *compromise* = "
        "TOPSIS with the profile weights (Farmer_Priorities). Climate-risk weight uses robustness from M7 in the "
        "final build.", "",
    ]
    (REPORTS / "05_optimizer.md").write_text("\n".join(md), encoding="utf-8")
    return out
