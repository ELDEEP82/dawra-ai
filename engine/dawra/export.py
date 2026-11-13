"""Plan → JSON for the web app (schema of Prompt 5, extended with labels and comparisons)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import HA_PER_FEDDAN
from .crop_params import CROP_AR
from .optimizer import Evaluated
from . import assumptions as A
from .simulate import FALLOW, Engine, Farm, slot_profit, straw_t_per_fdn
from .water_salt import slot_start

LABELS = {
    "current": ("Your current rotation", "دورتك الحالية"),
    "max_profit": ("Highest output", "الأعلى إنتاجًا"),
    "max_profit_priced": ("Highest profit", "الأعلى ربحًا"),
    "min_water": ("Water saver", "الموفّرة للمياه"),
    "best_soil": ("Soil builder", "المحسّنة للتربة"),
    "compromise": ("Best balance for you", "الأنسب ليك (متوازنة)"),
}


def _r(x, nd: int = 1) -> float | None:
    """Round a scalar / 1-element array for JSON (None for NaN)."""
    v = float(np.asarray(x).reshape(-1)[0]) if np.size(x) else float("nan")
    return None if np.isnan(v) else round(v, nd)


def _md(ts: pd.Timestamp) -> str:
    return ts.strftime("%m-%d")


def season_rows(e: Evaluated, eng: Engine) -> list[dict]:
    """Per-slot JSON rows with sowing/harvest dates and the agronomy numbers."""
    rows = []
    for s in e.sim.slots:
        row = {"slot": s.slot, "crop_id": s.crop_id, "crop_en": "Fallow" if s.crop_id == FALLOW else
               eng.crops[s.crop_id].crop_en, "crop_ar": CROP_AR[s.crop_id], "part": s.part}
        if s.crop_id != FALLOW:
            c = eng.crops[s.crop_id]
            sow = slot_start(c.slot, 2001) + pd.Timedelta(days=c.sow_offset)
            row.update({
                "family": c.family, "use": c.use, "sow": _md(sow) if s.part == 0 else None,
                "harvest": _md(sow + pd.Timedelta(days=c.total_days)) if (not c.perennial or s.part == 1) else None,
                "area_fdn": round(s.area_fdn, 2), "water_mm": _r(s.water_mm, 0), "water_m3": _r(s.water_m3, 0),
                "etc_mm": _r(s.etc_mm, 0), "lr_pct": round(s.lr * 100, 1), "salt_ry_pct": _r(s.salt_ry),
                "heat_factor": _r(s.heat_f, 3), "rel_yield_pct": _r(s.rel_yield_pct),
                "yield_kg_ha": _r(s.yield_kg_ha, 0), "yield_t_per_fdn": _r(s.yield_kg_ha * HA_PER_FEDDAN / 1000, 2),
                "farm_output_t": _r(s.yield_kg_ha * HA_PER_FEDDAN / 1000 * s.area_fdn, 2),
                "ece_mean": _r(s.ece_mean, 2), "salt_rating": c.salt_rating, "n_fixing": c.n_fixing,
                "revenue_egp": None, "cost_egp": None,
            })
            if s.crop_id in eng.price_map:
                price, cost = eng.price_map[s.crop_id]
                if c.perennial:
                    cost *= A.get("econ.perennial_cost_split")
                pump = float(np.asarray(s.water_m3).reshape(-1)[0]) * A.get("econ.pump_egp_m3")
                grain_t = s.yield_kg_ha * HA_PER_FEDDAN / 1000
                row["revenue_egp"] = _r(grain_t * s.area_fdn * price
                                        + straw_t_per_fdn(s.crop_id, grain_t) * s.area_fdn * A.get("econ.straw_price"), 0)
                row["cost_egp"] = round(cost * s.area_fdn, 0)
                row["pumping_egp"] = round(pump, 0)
                row["profit_egp"] = _r(slot_profit(s, eng), 0)
        else:
            row.update({"area_fdn": 0, "water_mm": 0, "water_m3": 0, "rel_yield_pct": None, "yield_kg_ha": 0})
        rows.append(row)
    return rows


def trajectory(e: Evaluated) -> list[dict]:
    """Soil state at start and after each season."""
    names = ["start", "W1", "S1", "W2", "S2", "W3", "S3"]
    return [{"t": n, "ece": _r(s.ece, 2), "soc": _r(s.soc_pct, 3), "n": _r(s.n_mg_kg, 1)}
            for n, s in zip(names, e.sim.trajectory)]


def plan_json(e: Evaluated, kind: str, eng: Engine, farm: Farm, current: Evaluated, priced: bool) -> dict:
    """Full plan object (robustness / explanation / what-if are filled by M7)."""
    lab = LABELS["max_profit_priced" if (kind == "max_profit" and priced) else kind]
    end = e.sim.end
    return {
        "id": kind, "kind": kind, "label_en": lab[0], "label_ar": lab[1], "plan": list(e.plan),
        "seasons": season_rows(e, eng),
        "totals": {
            "value": round(e.value, 4), "value_kind": "profit_egp" if priced else "productivity_index",
            "value_vs_current_pct": round((e.value / current.value - 1) * 100, 1) if current.value else None,
            "water_m3": round(e.water_m3), "water_vs_current_pct": round((e.water_m3 / current.water_m3 - 1) * 100, 1),
            "water_m3_per_year": round(e.water_m3 / 3), "soil_index": round(e.soil_index, 1),
            "profit_per_feddan_year": round(e.value / farm.area_fdn / 3) if priced else None,
            "ECe_end": _r(end.ece, 2), "SOC_end": _r(end.soc_pct, 3), "N_end": _r(end.n_mg_kg, 1),
            "min_rel_yield": round(e.min_ry, 1), "market_score": round(e.market, 2),
            "cropped_seasons": sum(1 for c in e.plan if c != FALLOW), "pest_flags": end.pest_flags,
        },
        "soil_trajectory": trajectory(e), "robustness": None, "explanation": None,
    }
