"""M4 — seasonal soil 'digital twin': ECe, SOC, available N, crop-family history.

State fields may be floats or numpy arrays (one value per stress scenario),
so a whole scenario ensemble advances in one vectorised call.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace

import numpy as np

from . import assumptions as A
from .crop_params import Crop
from .water_salt import ece_ratio_fao29


@dataclass(frozen=True)
class SoilState:
    """Root-zone state at the start of a season."""

    ece: np.ndarray | float  # dS/m saturated paste
    soc_pct: np.ndarray | float  # %
    n_mg_kg: np.ndarray | float  # available N mg/kg
    families: tuple[str | None, ...] = field(default=())  # most recent last (max 2 kept)
    season_index: int = 0
    pest_flags: int = 0


def ece_calibration_factor(ece_meas: float, ecw_meas: float) -> float:
    """Scale on the FAO-29 ECe/ECw curve so that LF = soil.lf_cal reproduces the measured ratio (S4)."""
    return (ece_meas / ecw_meas) / ece_ratio_fao29(A.get("soil.lf_cal"))


def ece_steady(ecw, lf, k_cal: float):
    """Steady-state root-zone ECe for irrigation water ECw at leaching fraction LF."""
    return k_cal * ece_ratio_fao29(lf) * np.asarray(ecw, dtype=float)


def soil_c_t_ha(soc_pct):
    """SOC % → t C/ha in the pool depth: % /100 · BD · depth · 10 000."""
    return np.asarray(soc_pct) / 100.0 * A.get("soil.bulk_density") * A.get("soil.pool_depth") * 10000.0


def kg_ha_per_mg_kg() -> float:
    """kg/ha of nutrient per 1 mg/kg in the pool depth (BD · depth · 10)."""
    return A.get("soil.bulk_density") * A.get("soil.pool_depth") * 10.0


def mix_ece(ece_start, ece_ss, drainage_mm, zone_m: float, theta_fc: float):
    """Exponential approach to steady state; returns (ECe_end, ECe_season_mean).

    The pore water exchanged is drainage / (θFC · root zone). The season mean is
    the time-average of the exponential path, used for the yield response.
    """
    x = np.asarray(drainage_mm, dtype=float) / (theta_fc * zone_m * 1000.0)
    e = np.exp(-x)
    end = ece_ss + (ece_start - ece_ss) * e
    frac = np.where(x > 1e-9, (1 - e) / np.where(x > 1e-9, x, 1.0), 1.0)
    mean = ece_ss + (ece_start - ece_ss) * frac
    return end, mean


def step(state: SoilState, crop: Crop | None, ecw, lf, drainage, rel_yield_frac, theta_fc: float, k_cal: float,
         area_frac=1.0) -> tuple[SoilState, np.ndarray | float]:
    """Advance one season.

    ``crop=None`` means fallow. ``area_frac`` is the share of the farm actually
    planted (water-limited); the rest of the farm follows the fallow path and
    the returned state is the area-weighted farm average. Returns
    ``(new_state, ece_season_mean_on_cropped_area)``.
    """
    fall_ece = state.ece * (1.0 + A.get("soil.fallow_ece_rise"))
    fall_soc = soil_c_t_ha(state.soc_pct) * (1 - A.get("soil.soc_decay_fallow"))
    fall_n = np.asarray(state.n_mg_kg, dtype=float)
    if crop is None:
        new = replace(state, ece=fall_ece, soc_pct=_c_to_pct(fall_soc), n_mg_kg=fall_n,
                      families=(state.families + (None,))[-2:], season_index=state.season_index + 1)
        return new, fall_ece
    ss = ece_steady(ecw, lf, k_cal)
    crop_ece, ece_mean = mix_ece(state.ece, ss, drainage, crop.root_m, theta_fc)
    c_in = A.get(f"soil.resC.{crop.residue_group}") * np.asarray(rel_yield_frac) * A.get("soil.humification")
    crop_soc = soil_c_t_ha(state.soc_pct) * (1 - A.get("soil.soc_decay_crop")) + c_in
    if crop.n_fixing:
        crop_n = state.n_mg_kg + A.get(f"soil.nfix.{crop.crop_id}") * np.asarray(rel_yield_frac) / kg_ha_per_mg_kg()
    else:
        crop_n = np.asarray(state.n_mg_kg, dtype=float) * (1 - A.get("soil.n_loss_crop"))
    f = np.asarray(area_frac, dtype=float)
    fams = (state.families + (crop.family,))[-3:]
    flag = int(len(fams) == 3 and len(set(fams)) == 1 and fams[0] is not None)
    new = SoilState(
        ece=f * crop_ece + (1 - f) * fall_ece,
        soc_pct=_c_to_pct(f * crop_soc + (1 - f) * fall_soc),
        n_mg_kg=f * crop_n + (1 - f) * fall_n,
        families=fams[-2:], season_index=state.season_index + 1, pest_flags=state.pest_flags + flag,
    )
    return new, ece_mean


def _c_to_pct(c_t_ha):
    """t C/ha → SOC %."""
    return np.asarray(c_t_ha) / (A.get("soil.bulk_density") * A.get("soil.pool_depth") * 10000.0) * 100.0


def soil_health_index(start: SoilState, end: SoilState):
    """0–100 index (50 = unchanged) from relative changes in ECe (down is good), SOC and N (up is good)."""
    s = A.get("si.scale")

    def rel(new, old):
        return np.clip((np.asarray(new) - old) / old / s, -1, 1)

    score = (A.get("si.w_ece") * -rel(end.ece, start.ece) + A.get("si.w_soc") * rel(end.soc_pct, start.soc_pct)
             + A.get("si.w_n") * rel(end.n_mg_kg, start.n_mg_kg))
    wsum = A.get("si.w_ece") + A.get("si.w_soc") + A.get("si.w_n")
    out = 50.0 + 50.0 * score / wsum - A.get("si.pest_penalty") * end.pest_flags
    out = np.clip(out, 0, 100)
    return float(out) if np.ndim(out) == 0 else out
