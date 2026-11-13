"""Writes reports/03_agronomy.md (Prompt 3): current rotation, calibration, holdout, assumptions."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import assumptions as A
from .calibration import build_engine, default_farm
from .config import REPORTS
from .reporting import md_table, new_fig, save_fig
from .simulate import FALLOW, Engine, simulate

CURRENT = ("barley", FALLOW) * 3


def current_rotation(last_crop: str) -> tuple[str, ...]:
    """Farmer's current rotation: last_crop in winter, fallow in summer, × 3 (Prompt 5)."""
    return (last_crop, FALLOW) * 3


def rotation_table(eng: Engine, plan: tuple[str, ...], ecw: float | None = None) -> pd.DataFrame:
    """Season-by-season table for a plan (typical climate)."""
    farm = default_farm(ecw=ecw)
    r = simulate(plan, farm, eng)
    rows = []
    for s, st in zip(r.slots, r.trajectory[1:]):
        rows.append({
            "slot": s.slot, "crop": s.crop_id, "area_fdn": s.area_fdn, "water_mm": float(s.water_mm[0]),
            "water_m3": float(s.water_m3[0]), "rel_yield_%": float(np.nan_to_num(s.rel_yield_pct[0])),
            "yield_kg_ha": float(s.yield_kg_ha[0]), "ECe_end": float(st.ece[0]), "SOC_%": float(st.soc_pct[0]),
            "N_mg_kg": float(st.n_mg_kg[0]),
        })
    return pd.DataFrame(rows)


def write_report() -> str:
    """Generate the report text and figure."""
    eng, info = build_engine()
    farm = default_farm()
    plan = current_rotation(farm.last_crop)
    tab = rotation_table(eng, plan)
    r = simulate(plan, farm, eng)

    fig, ax = new_fig(8, 3.5)
    x = np.arange(7)
    ax.plot(x, [float(s.ece[0]) for s in r.trajectory], "o-", color="#e76f51", label="ECe dS/m")
    ax.set_xticks(x, ["start", "W1", "S1", "W2", "S2", "W3", "S3"])
    ax.set_ylabel("ECe (dS/m)")
    ax2 = ax.twinx()
    ax2.plot(x, [float(s.n_mg_kg[0]) for s in r.trajectory], "s--", color="#2a9d8f", label="N mg/kg")
    ax2.set_ylabel("Available N (mg/kg)")
    ax.set_title("F001 current rotation (barley / fallow ×3) — soil twin")
    fig_path = save_fig(fig, "03_current_rotation_soil.png")

    cal_rows = []
    for cid, v in info["calibration"].items():
        c = v["calibration"]
        cal_rows.append({"crop": cid, "observed_kg_ha": c.observed_kg_ha, "modelled_rel_yield_%": c.rel_yield_pct,
                         "ECe_mean": v["conditions"]["ece_mean"], "ymax_kg_ha": c.ymax_kg_ha, "source": c.source})
    h = info["holdout"]
    checks = [info["ece_check"], h["per_feddan"], h["per_ha"], info["s1_water"]]
    chk = pd.DataFrame([{"check": c.name, "modelled": c.modelled, "observed": c.observed, "unit": c.unit,
                         "error_%": c.error_pct, "source": c.source} for c in checks])
    used = A.table().reset_index()
    used = used[used["module"].isin(["water_salt", "calendar", "yield", "soil_twin", "calibration"])]
    md = [
        "# 03 — Agronomy engine (M2 water & salt · M3 yield · M4 soil twin)", "",
        f"Farm F001: {farm.area_fdn:g} feddan, well ECw {farm.ecw} dS/m, {farm.water_m3_day:g} m³/day, {farm.system}. "
        f"Starting soil: ECe {farm.ece0}, SOC {farm.soc0} %, N {farm.n0} mg/kg (Soil_Baseline).", "",
        "## Current rotation (barley winter / fallow summer ×3), typical climate 1991–2020", "",
        md_table(tab, "{:.2f}"), "",
        f"Totals: water **{float(r.water_m3[0]):,.0f} m³** in 3 years, productivity index {float(r.productivity[0]):.2f}, "
        f"soil health index {float(r.soil_index[0]):.1f} (50 = unchanged).", "",
        "Planted area is water-limited: the well's m³/day divided by the crop's peak 10-day gross demand "
        "(FAO-56 ETc, FAO-29 leaching, drip Ea 0.90). The rest of the farm stays fallow that season.", "",
        f"![soil]({fig_path.as_posix()})", "",
        "## Calibration (fitted)", "",
        f"ECe/ECw calibration factor k = **{info['k_cal']:.3f}** on the FAO-29 relation ECe/ECw = (1+LF)/(5·LF), "
        f"so LF {A.get('soil.lf_cal')} gives the measured 8.56 at ECw 7.94 (S4).", "",
        md_table(pd.DataFrame(cal_rows), "{:.2f}"), "",
        "Barley uses the S1 trial's own water (≈400 mm furrow, Local_Yields) and seasons 2018/19–2019/20.", "",
        "## Checks (not fitted)", "", md_table(chk, "{:.1f}"), "",
        "*Wheat holdout*: S6 reports 16.5 ardeb (~2.48 t) and the sheet notes the area unit is not stated. "
        "Read per feddan (5.9 t/ha) the error is within ±20 %; read per hectare it is not. Both are shown.", "",
        "*S1 water*: the FAO-29 gross requirement (with leaching and furrow losses) is higher than the ~400 mm the "
        "trial applied — the trial ran with less leaching than FAO-29 recommends. Dawra plans use the FAO-29 "
        "requirement (conservative for water).", "",
        "## Assumptions used by M2–M4", "",
        md_table(used[["id", "value", "unit", "justification", "source"]]), "",
    ]
    text = "\n".join(md)
    (REPORTS / "03_agronomy.md").write_text(text, encoding="utf-8")
    return text
