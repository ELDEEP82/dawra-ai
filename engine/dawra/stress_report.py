"""Writes reports/06_stress.md (Prompt 6) and fills robustness + cards in plans_F001.json."""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from . import stress as S
from .calibration import build_engine, default_farm
from .config import PROCESSED, REPORTS
from .context import card_context
from .data_io import load_farmer_profiles
from .explain import card
from .reporting import md_table, new_fig, save_fig


def write_report() -> str:
    """Robustness of the F001 plans (balanced profile) with a grouped bar chart."""
    eng, _ = build_engine()
    farm = default_farm()
    path = PROCESSED / "plans_F001.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    plans = data["plans"]
    for p in plans:
        p["robustness"] = S.robustness(tuple(p["plan"]), farm, eng)
    cur = next(p for p in plans if p["kind"] == "current")
    ctx = card_context(eng, farm.ecw, "balanced", load_farmer_profiles()["balanced"].to_dict(), 120,
                       data["prices_pending"], "pending")
    for p in plans:
        p["explanation"] = card(p, cur, ctx)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    fams = [b["key"] for b in plans[0]["robustness"]["by_scenario"]]
    fig, ax = new_fig(9, 4)
    w = 0.8 / len(plans)
    for j, p in enumerate(plans):
        vals = [b["pass_pct"] for b in p["robustness"]["by_scenario"]]
        ax.bar(np.arange(len(fams)) + j * w, vals, w, label=p["kind"])
    ax.set_xticks(np.arange(len(fams)) + 0.4 - w / 2, fams)
    ax.set_ylabel("% of draws passing")
    ax.set_ylim(0, 105)
    ax.set_title("Robustness by scenario family (200 bootstrap 3-year draws each)")
    ax.legend(fontsize=8, ncol=5, loc="lower center")
    fig_path = save_fig(fig, "06_robustness.png")

    rows = [{"plan": p["kind"], "robustness_%": p["robustness"]["robustness_pct"],
             **{b["key"]: b["pass_pct"] for b in p["robustness"]["by_scenario"]},
             "worst_cause": p["robustness"]["worst"]["cause"]} for p in plans]
    ex = next(p for p in plans if p["kind"] == "compromise")["explanation"]
    md = [
        "# 06 — Stress test & explanation cards (M7)", "",
        "Scenario families: historical block bootstrap (agricultural years W(y)+S(y+1), 1981–2025, 3 blocks drawn with "
        "replacement, n = 200, seed 7), +1/+2 °C (ET0 recomputed), −10/−20 % rain, well ECw +1/+2 dS/m "
        "(aquifer 'highly saline' share 52 % → 83 %, S16). CMIP6 deltas: **pending** (needs Earth Engine).", "",
        "Pass = every cropped season ≥ 70 % of its typical-climate yield AND final ECe ≤ starting ECe. In each "
        "scenario the planted area is fixed beforehand from the typical climate and the well's m³/day cap applies "
        "during the peak period, so hotter years and saltier water first cut leaching, then crop water (FAO-33 Ky).", "",
        f"![robustness]({fig_path.as_posix()})", "",
        md_table(pd.DataFrame(rows)), "",
        "**Reading.** Robustness is high for most plans: in this hyper-arid site rain is a tiny share of the water "
        "balance (so −20 % rain barely matters), and when the full FAO-29 leaching water is applied the yield stays "
        "near potential. The price of heat and salinity is paid in *water per feddan* (fewer feddan the well can "
        "irrigate), which the optimiser already counts. The plans that fail most often do so through salt build-up "
        "after unirrigated summer fallows.", "",
        "## Example card — balanced compromise (English)", "",
        *[f"**{k}**\n" + "\n".join(f"- {s}" for s in v) + "\n" for k, v in ex["en"].items()],
        "## نفس الكارت بالعربي", "",
        *[f"**{k}**\n" + "\n".join(f"- {s}" for s in v) + "\n" for k, v in ex["ar"].items()],
    ]
    text = "\n".join(md)
    (REPORTS / "06_stress.md").write_text(text, encoding="utf-8")
    return text
