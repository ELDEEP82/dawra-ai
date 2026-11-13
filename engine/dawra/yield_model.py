"""M3 — salt and heat yield response, with local calibration (S1) and holdout (S6)."""
from __future__ import annotations

from dataclasses import dataclass, replace

import numpy as np

from . import assumptions as A
from .crop_params import Crop


def maas_hoffman(ece, a: float, b: float):
    """Relative yield % = 100 − b·(ECe − a), clipped to 0–100 (Maas & Hoffman 1977, FAO-29)."""
    y = 100.0 - b * (np.asarray(ece, dtype=float) - a)
    out = np.clip(y, 0.0, 100.0)
    return float(out) if np.ndim(out) == 0 else out


def salt_rel_yield(crop: Crop, ece):
    """Relative yield % of ``crop`` at root-zone ECe."""
    return maas_hoffman(ece, crop.ece100, crop.slope_b)


def heat_factor(hot_mid_days):
    """Multiplicative heat factor: 1 − min(max_penalty, penalty_per_day · hot mid-season days)."""
    pen = np.minimum(A.get("heat.max_penalty"), A.get("heat.penalty_per_day") * np.asarray(hot_mid_days, float))
    out = 1.0 - pen
    return float(out) if np.ndim(out) == 0 else out


def expected_yield(crop: Crop, ece, hot_mid_days, ymax: float | None = None):
    """Yield kg/ha = ymax · RY_salt/100 · heat_factor."""
    ym = crop.ymax if ymax is None else ymax
    return ym * salt_rel_yield(crop, ece) / 100.0 * heat_factor(hot_mid_days)


@dataclass(frozen=True)
class Calibration:
    """Result of calibrating one crop's ymax to an observed local yield."""

    crop_id: str
    observed_kg_ha: float
    rel_yield_pct: float
    heat_factor: float
    ymax_kg_ha: float
    source: str


def calibrate_ymax(crop: Crop, observed: float, ece_mean: float, hot_mid: float, source: str) -> Calibration:
    """ymax such that the model reproduces ``observed`` at the given conditions."""
    ry = salt_rel_yield(crop, ece_mean)
    hf = heat_factor(hot_mid)
    if ry * hf <= 0:
        raise ValueError(f"cannot calibrate {crop.crop_id}: modelled relative yield is 0")
    return Calibration(crop.crop_id, observed, ry, hf, observed / (ry / 100.0 * hf), source)


def with_ymax(crop: Crop, ymax: float, source: str) -> Crop:
    """Copy of ``crop`` with a calibrated ymax."""
    return replace(crop, ymax=ymax, ymax_source=source)
