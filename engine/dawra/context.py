"""Shared context for explanation cards and the web export (climate summary, crop notes, …)."""
from __future__ import annotations

from functools import lru_cache

from .calibration import climate_daily
from .climate import annual_summary
from .simulate import Engine
from .yield_model import maas_hoffman

PROFILE_AR = {"balanced": "متوازن", "profit_first": "الربح أولًا", "water_saving": "توفير المية",
              "soil_building": "بناء التربة", "this_farmer": "المزارع ده"}


@lru_cache(maxsize=1)
def climate_summary() -> dict[str, float]:
    """Long-term NASA POWER summary used in the evidence text."""
    df = climate_daily()
    ann = annual_summary(df)
    ann = ann[(ann.index >= 1981) & (ann.index <= 2025)]
    summer = df[df.index.month.isin([5, 6, 7, 8, 9, 10])]
    return {"et0_mm": float(ann["ET0_mm"].mean()), "rain_mm": float(ann["rain_mm"].mean()),
            "heat_days": float(ann["heat_days"].mean()), "gwet_summer": float(summer["GWETROOT"].mean()),
            "years": f"{int(ann.index.min())}–{int(ann.index.max())}"}


def card_context(eng: Engine, ecw: float, profile: str, weights: dict[str, float], n_front: int,
                 prices_pending: bool, eo_status: str) -> dict:
    """Everything explain.card() needs besides the plan itself."""
    ece_fao = 1.5 * ecw  # Salinity_Yield sheet: ECe ≈ 1.5 × ECw (FAO-29, LF 15-20 %)
    return {
        "ecw": ecw, "profile": profile, "profile_ar": PROFILE_AR.get(profile, profile), "weights": weights,
        "n_front": n_front, "prices_pending": prices_pending, "eo_status": eo_status, "climate": climate_summary(),
        "crop_notes": {k: list(c.notes) for k, c in eng.crops.items()},
        "ymax_source": {k: c.ymax_source for k, c in eng.crops.items()},
        "ry_without_leaching": {k: float(maas_hoffman(ece_fao, c.ece100, c.slope_b)) for k, c in eng.crops.items()},
        "eo_sentence_en": "", "eo_sentence_ar": "",
        "price_estimated": set(eng.prices.index[eng.prices["is_assumption"] == 1]) if eng.prices is not None else set(),
    }
