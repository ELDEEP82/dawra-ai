"""M2 — crop water demand and salt management (FAO-56 Kc, FAO-29 leaching).

Also builds the *season bank*: for every crop and season-year of a climate
series, the seasonal ETc, effective rain, peak net demand and hot mid-season
days — the inputs every plan simulation and stress scenario reuses.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from . import assumptions as A
from .config import M3_PER_MM_FEDDAN
from .crop_params import Crop

PERENNIAL_SPLIT = 182  # days of a perennial's year that fall in its first slot


# --------------------------------------------------------------------------- Kc & ETc
def kc_array(crop: Crop) -> np.ndarray:
    """Daily Kc for the whole season (FAO-56 4-stage linear curve, Fig. 25)."""
    ini, dev, mid, late = crop.stage_days()
    k_ini, k_mid, k_end = crop.kc
    seg = [
        np.full(ini, k_ini),
        np.linspace(k_ini, k_mid, dev, endpoint=False) if dev else np.array([]),
        np.full(mid, k_mid),
        np.linspace(k_mid, k_end, late) if late else np.array([]),
    ]
    return np.concatenate(seg)[: crop.total_days]


def slot_start(slot: str, season_year: int) -> pd.Timestamp:
    """Start of a slot: winter → 1 Nov of season_year, summer → 1 May."""
    return pd.Timestamp(season_year, 11, 1) if slot == "W" else pd.Timestamp(season_year, 5, 1)


def sow_date(crop: Crop, season_year: int) -> pd.Timestamp:
    """Sowing date = slot start + documented offset (assumptions ``sow.*``)."""
    return slot_start(crop.slot, season_year) + pd.Timedelta(days=crop.sow_offset)


def kc_curve(crop: Crop, sow: pd.Timestamp) -> pd.Series:
    """Daily Kc indexed by date from ``sow`` (Prompt 3 API)."""
    k = kc_array(crop)
    return pd.Series(k, index=pd.date_range(sow, periods=len(k), freq="D"), name="Kc")


def etc_season(crop: Crop, sow: pd.Timestamp, clim: pd.DataFrame) -> tuple[pd.Series, float]:
    """Daily ETc (mm) and the season total, from a climate frame with ``ET0``."""
    kc = kc_curve(crop, sow)
    et0 = clim["ET0"].reindex(kc.index)
    etc = (kc * et0).rename("ETc")
    return etc, float(etc.sum(min_count=len(etc)))


# --------------------------------------------------------------------------- salt & irrigation
def leaching_requirement(ecw: float | np.ndarray, ece_t: float) -> float | np.ndarray:
    """FAO-29 LR = ECw / (5·ECe_t − ECw), capped to [0, ws.lr_cap]."""
    cap = A.get("ws.lr_cap")
    den = 5.0 * ece_t - np.asarray(ecw, dtype=float)
    lr = np.where(den > 0, np.asarray(ecw, dtype=float) / np.where(den > 0, den, 1.0), cap)
    out = np.clip(lr, 0.0, cap)
    return float(out) if np.ndim(out) == 0 else out


def ece_ratio_fao29(lf: float | np.ndarray) -> float | np.ndarray:
    """ECe/ECw implied by the FAO-29 LR equation: (1 + LF) / (5·LF)."""
    lf = np.maximum(np.asarray(lf, dtype=float), 0.02)
    out = (1.0 + lf) / (5.0 * lf)
    return float(out) if np.ndim(out) == 0 else out


def efficiency(system: str) -> float:
    """Application efficiency Ea for 'drip' | 'sprinkler' | 'furrow'."""
    return A.get(f"ws.ea_{system.lower()}")


def gross_irrigation(etc_mm, peff_mm, lr, ea: float):
    """Gross irrigation depth (mm) = max(ETc − Peff, 0) / (Ea · (1 − LR))."""
    net = np.maximum(np.asarray(etc_mm, dtype=float) - np.asarray(peff_mm, dtype=float), 0.0)
    return net / (ea * (1.0 - np.asarray(lr, dtype=float)))


def mm_to_m3_per_feddan(mm):
    """1 mm over 1 feddan = 4.2 m³ (CLAUDE.md units)."""
    return np.asarray(mm, dtype=float) * M3_PER_MM_FEDDAN


def drainage_mm(gross_mm, etc_mm, peff_mm):
    """Water passing below the root zone: applied + effective rain − ETc (≥ 0)."""
    return np.maximum(np.asarray(gross_mm) + np.asarray(peff_mm) - np.asarray(etc_mm), 0.0)


# --------------------------------------------------------------------------- season bank
@dataclass
class SeasonBank:
    """Per (crop, part) arrays over season-years: etc, peff, peak_net, hot_mid (+ year axis)."""

    years: dict[str, np.ndarray]  # slot -> season years available
    data: dict[tuple[str, int], pd.DataFrame]  # (crop_id, part) -> frame indexed by season_year

    def get(self, crop_id: str, part: int, year: int) -> pd.Series:
        """Row for one crop part and season-year."""
        return self.data[(crop_id, part)].loc[year]

    def typical(self, crop_id: str, part: int, y0: int, y1: int) -> pd.Series:
        """Mean over season-years y0..y1 (the 'typical year' used for planning)."""
        df = self.data[(crop_id, part)]
        return df[(df.index >= y0) & (df.index <= y1)].mean()


def _rolling_max_mean(x: np.ndarray, w: int) -> float:
    """Maximum of the w-day running mean (or the mean if the series is shorter)."""
    if len(x) <= w:
        return float(np.mean(x)) if len(x) else 0.0
    c = np.cumsum(np.insert(x, 0, 0.0))
    return float(np.max((c[w:] - c[:-w]) / w))


def build_bank(clim: pd.DataFrame, crops: dict[str, Crop]) -> SeasonBank:
    """Pre-compute seasonal water/heat terms for every crop and season-year in ``clim``.

    ``clim`` must contain daily ``ET0``, ``Peff`` and ``T2M_MAX`` on a continuous date index.
    """
    t0 = clim.index[0]
    et0 = clim["ET0"].to_numpy()
    peff = clim["Peff"].to_numpy()
    tmax = clim["T2M_MAX"].to_numpy()
    n = len(clim)
    win = int(A.get("ws.peak_window_days"))
    years = {s: np.arange(clim.index[0].year - 1, clim.index[-1].year + 1) for s in ("W", "S")}
    data: dict[tuple[str, int], pd.DataFrame] = {}
    for cid, crop in crops.items():
        kc = kc_array(crop)
        ini, dev, mid, _ = crop.stage_days()
        mid_lo, mid_hi = ini + dev, ini + dev + mid
        parts = [(0, PERENNIAL_SPLIT), (PERENNIAL_SPLIT, crop.total_days)] if crop.perennial else [(0, crop.total_days)]
        for p, (a, b) in enumerate(parts):
            rows = {}
            for y in years[crop.slot]:
                s = (sow_date(crop, int(y)) - t0).days
                if s + a < 0 or s + b > n:
                    continue
                sl = slice(s + a, s + b)
                etc_d = kc[a:b] * et0[sl]
                pe_d = peff[sl]
                lo, hi = max(mid_lo, a), min(mid_hi, b)
                hot = int(np.sum(tmax[s + lo:s + hi] > crop.tcrit)) if hi > lo else 0
                rows[int(y)] = {
                    "etc": float(etc_d.sum()), "peff": float(pe_d.sum()),
                    "peak_net": _rolling_max_mean(np.maximum(etc_d - pe_d, 0.0), win),
                    "hot_mid": hot, "et0": float(et0[sl].sum()),
                }
            data[(cid, p)] = pd.DataFrame.from_dict(rows, orient="index").sort_index()
    return SeasonBank(years=years, data=data)
