"""M1 climate — NASA POWER fetch/extension, FAO-56 Penman–Monteith ET0, effective rain, heat days.

References: FAO-56 (Allen et al. 1998) equations cited inline; USDA-SCS effective rain via FAO CROPWAT.
"""
from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests

from . import assumptions as A
from .config import POWER_CSV, POWER_ELEV_M, POWER_EXTENDED, POWER_LAT, POWER_LON
from .data_io import POWER_COLS, load_power, season_labels

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
GSC = 0.0820  # solar constant MJ m-2 min-1 (FAO-56 Eq.21)
SIGMA = 4.903e-9  # Stefan-Boltzmann MJ K-4 m-2 day-1


# --------------------------------------------------------------------------- FAO-56 building blocks
def sat_vp(t: np.ndarray | float) -> np.ndarray | float:
    """Saturation vapour pressure e°(T) in kPa (FAO-56 Eq.11)."""
    return 0.6108 * np.exp(17.27 * t / (t + 237.3))


def slope_vp(t: np.ndarray | float) -> np.ndarray | float:
    """Slope of the vapour-pressure curve Δ in kPa/°C (FAO-56 Eq.13)."""
    return 4098.0 * sat_vp(t) / (t + 237.3) ** 2


def psychro(elev_m: float) -> float:
    """Psychrometric constant γ in kPa/°C from elevation (FAO-56 Eq.7–8)."""
    p = 101.3 * ((293.0 - 0.0065 * elev_m) / 293.0) ** 5.26
    return 0.000665 * p


def extraterrestrial_rad(doy: np.ndarray | int, lat_deg: float) -> np.ndarray:
    """Daily extraterrestrial radiation Ra in MJ m-2 d-1 (FAO-56 Eq.21–25)."""
    j = np.asarray(doy, dtype=float)
    phi = np.deg2rad(lat_deg)
    dr = 1 + 0.033 * np.cos(2 * np.pi * j / 365)
    dec = 0.409 * np.sin(2 * np.pi * j / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    return 24 * 60 / np.pi * GSC * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))


def daylight_hours(doy: np.ndarray | int, lat_deg: float) -> np.ndarray:
    """Maximum daylight hours N (FAO-56 Eq.34)."""
    j = np.asarray(doy, dtype=float)
    dec = 0.409 * np.sin(2 * np.pi * j / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(np.deg2rad(lat_deg)) * np.tan(dec), -1, 1))
    return 24 / np.pi * ws


def et0_pm(tmax, tmin, rs, ea, u2, doy, lat_deg: float, elev_m: float) -> np.ndarray:
    """FAO-56 Penman–Monteith reference ET (mm/day), G = 0 for daily steps (Eq.6).

    Parameters are arrays (or scalars): °C, MJ m-2 d-1, kPa, m/s, day-of-year.
    """
    tmax, tmin, rs, ea, u2 = (np.asarray(x, dtype=float) for x in (tmax, tmin, rs, ea, u2))
    tmean = (tmax + tmin) / 2
    delta = slope_vp(tmean)
    gamma = psychro(elev_m)
    es = (sat_vp(tmax) + sat_vp(tmin)) / 2
    ra = extraterrestrial_rad(doy, lat_deg)
    rso = (0.75 + 2e-5 * elev_m) * ra  # Eq.37
    rns = (1 - A.get("clim.albedo")) * rs  # Eq.38
    ratio = np.clip(rs / np.where(rso > 0, rso, np.nan), 0.25, 1.0)
    rnl = SIGMA * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 * (0.34 - 0.14 * np.sqrt(ea)) * (1.35 * ratio - 0.35)
    rn = rns - rnl
    num = 0.408 * delta * rn + gamma * 900 / (tmean + 273) * u2 * (es - ea)
    return num / (delta + gamma * (1 + 0.34 * u2))


def et0_fao56(df: pd.DataFrame, lat: float = POWER_LAT, elev: float = POWER_ELEV_M, d_t: float = 0.0) -> pd.Series:
    """Daily ET0 (mm/day) from a POWER frame; ``ea`` from mean RH (FAO-56 Eq.19).

    ``d_t`` shifts Tmax/Tmin for warming scenarios while holding RH constant
    (standard delta-change practice), so ea rises with es.
    """
    tmax = df["T2M_MAX"].to_numpy() + d_t
    tmin = df["T2M_MIN"].to_numpy() + d_t
    es = (sat_vp(tmax) + sat_vp(tmin)) / 2
    ea = df["RH2M"].to_numpy() / 100.0 * es
    rs = df["ALLSKY_SFC_SW_DWN"].to_numpy()
    doy = df.index.dayofyear.to_numpy()
    out = et0_pm(tmax, tmin, rs, ea, df["WS2M"].to_numpy(), doy, lat, elev)
    return pd.Series(np.maximum(out, 0.0), index=df.index, name="ET0")


# --------------------------------------------------------------------------- rain & heat
def effective_rain_monthly(p_mm: np.ndarray | pd.Series) -> np.ndarray | pd.Series:
    """USDA-SCS (FAO CROPWAT) effective rainfall for MONTHLY totals in mm."""
    a, b, cap = A.get("clim.peff_a"), A.get("clim.peff_b"), A.get("clim.peff_cap")
    p = np.asarray(p_mm, dtype=float)
    low = p * (a - b * p) / a
    high = a + 0.1 * p
    out = np.where(p <= cap, low, high)
    out = np.clip(out, 0, None)
    return pd.Series(out, index=p_mm.index) if isinstance(p_mm, pd.Series) else out


def daily_peff(precip: pd.Series) -> pd.Series:
    """Distribute monthly USDA-SCS Peff back to days in proportion to daily rain."""
    mon = precip.resample("MS").sum()
    ratio = (effective_rain_monthly(mon) / mon.replace(0, np.nan)).fillna(0.0)
    r_daily = ratio.reindex(precip.index, method="ffill")
    return (precip * r_daily).rename("Peff")


def heat_days(df: pd.DataFrame, threshold: float) -> int:
    """Number of days with T2M_MAX above ``threshold`` °C."""
    return int((df["T2M_MAX"] > threshold).sum())


# --------------------------------------------------------------------------- POWER API
def fetch_power(lat: float, lon: float, start: str, end: str, timeout: int = 120) -> pd.DataFrame:
    """Fetch NASA POWER daily point data (community AG). ``start``/``end`` as YYYYMMDD."""
    params = {
        "parameters": ",".join(POWER_COLS), "community": "AG", "longitude": lon, "latitude": lat,
        "start": start, "end": end, "format": "JSON",
    }
    for attempt in range(4):
        try:
            r = requests.get(POWER_URL, params=params, timeout=timeout)
            r.raise_for_status()
            break
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
    data = r.json()["properties"]["parameter"]
    df = pd.DataFrame(data)
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df.index.name = "date"
    return df.replace(-999.0, np.nan)[POWER_COLS].astype(float)


def extend_power(cache: Path = POWER_EXTENDED, start_year: int = 1981, refresh: bool = False) -> pd.DataFrame:
    """Return POWER daily 1981-01-01 → end of our CSV, cached as parquet.

    Our team-verified CSV is used wherever it exists; the API fills earlier years.
    The overlap (2020–2021) is compared and the max abs difference is stored in ``df.attrs``.
    """
    if cache.exists() and not refresh:
        return pd.read_parquet(cache)
    local = load_power(POWER_CSV)
    pieces = []
    for y0 in range(start_year, local.index[0].year + 2, 10):
        y1 = min(y0 + 9, local.index[0].year + 1)
        pieces.append(fetch_power(POWER_LAT, POWER_LON, f"{y0}0101", f"{y1}1231"))
    api = pd.concat(pieces).sort_index()
    api = api[~api.index.duplicated()]
    overlap = local.index.intersection(api.index)
    diff = (local.loc[overlap] - api.loc[overlap]).abs().max()
    merged = pd.concat([api[api.index < local.index[0]], local]).sort_index()
    merged = gap_fill_solar(merged)
    cache.parent.mkdir(parents=True, exist_ok=True)
    merged.to_parquet(cache)
    pd.DataFrame({"max_abs_diff": diff, "n_overlap_days": len(overlap)}).to_csv(cache.with_suffix(".overlap.csv"))
    return merged


def gap_fill_solar(df: pd.DataFrame) -> pd.DataFrame:
    """Fill missing solar radiation with Hargreaves Rs = kRs·√(Tmax−Tmin)·Ra (FAO-56 Eq.50).

    The coastal default kRs underestimates CERES here, so Hargreaves is bias-corrected
    per calendar month with the ratio CERES/Hargreaves over all days that have both.
    Filled days are flagged in ``rs_filled``.
    """
    out = df.copy()
    miss = out["ALLSKY_SFC_SW_DWN"].isna()
    if miss.any():
        ra = extraterrestrial_rad(out.index.dayofyear.to_numpy(), POWER_LAT)
        hs = pd.Series(A.get("clim.krs") * np.sqrt((out["T2M_MAX"] - out["T2M_MIN"]).clip(lower=0)) * ra,
                       index=out.index)
        ok = ~miss
        month = out.index.month
        ratio = (out.loc[ok, "ALLSKY_SFC_SW_DWN"].groupby(month[ok.to_numpy()]).sum()
                 / hs[ok].groupby(month[ok.to_numpy()]).sum())
        corrected = hs * pd.Series(month, index=out.index).map(ratio).to_numpy()
        out.loc[miss, "ALLSKY_SFC_SW_DWN"] = corrected[miss]
    out["rs_filled"] = miss.astype(int)
    for c in ("T2M_MIN", "T2M_MAX", "RH2M", "WS2M", "PRECTOTCORR", "GWETROOT", "TS"):
        if out[c].isna().any():
            out[c] = out[c].interpolate(limit=5).fillna(out[c].groupby(out.index.dayofyear).transform("mean"))
    return out


# --------------------------------------------------------------------------- summaries
def add_derived(df: pd.DataFrame, d_t: float = 0.0, rain_scale: float = 1.0) -> pd.DataFrame:
    """Daily frame with ET0 and Peff (optionally warmed by ``d_t`` and rain scaled)."""
    out = df.copy()
    out["T2M_MAX"] = out["T2M_MAX"] + d_t
    out["T2M_MIN"] = out["T2M_MIN"] + d_t
    out["PRECTOTCORR"] = out["PRECTOTCORR"] * rain_scale
    out["ET0"] = et0_fao56(df, d_t=d_t).to_numpy()
    out["Peff"] = daily_peff(out["PRECTOTCORR"]).to_numpy()
    return out


def annual_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Annual ET0 (mm), rain (mm), mean Tmax, heat days — complete years only."""
    thr = A.get("clim.heat_report_c")
    g = df.groupby(df.index.year)
    out = pd.DataFrame({
        "ET0_mm": g["ET0"].sum(), "rain_mm": g["PRECTOTCORR"].sum(), "tmax_mean": g["T2M_MAX"].mean(),
        "tmin_mean": g["T2M_MIN"].mean(), "heat_days": g["T2M_MAX"].apply(lambda s: int((s > thr).sum())),
        "gwetroot": g["GWETROOT"].mean(), "n": g.size(),
    })
    return out[out["n"] >= 365].drop(columns="n")


def monthly_climatology(df: pd.DataFrame, y0: int | None = None, y1: int | None = None) -> pd.DataFrame:
    """Mean monthly Tmin, Tmax, precip (mm/month), ET0 (mm/month) over years y0..y1."""
    y0 = y0 or int(A.get("clim.normal_start"))
    y1 = y1 or int(A.get("clim.normal_end"))
    sub = df[(df.index.year >= y0) & (df.index.year <= y1)]
    mon = sub.resample("MS").agg({"T2M_MIN": "mean", "T2M_MAX": "mean", "PRECTOTCORR": "sum", "ET0": "sum",
                                  "GWETROOT": "mean"})
    return mon.groupby(mon.index.month).mean()


def season_table(df: pd.DataFrame) -> pd.DataFrame:
    """Per season (W/S, season_year): rain, ET0, mean Tmax, heat days; complete seasons only."""
    lab = season_labels(df.index)
    tmp = df[["PRECTOTCORR", "ET0", "T2M_MAX"]].join(lab)
    thr = A.get("clim.heat_report_c")
    g = tmp.groupby(["season_year", "season"])
    out = pd.DataFrame({
        "rain_mm": g["PRECTOTCORR"].sum(), "ET0_mm": g["ET0"].sum(), "tmax_mean": g["T2M_MAX"].mean(),
        "heat_days": g["T2M_MAX"].apply(lambda s: int((s > thr).sum())), "n": g.size(),
    })
    return out[out["n"] >= 180].drop(columns="n")


def extreme_seasons(st: pd.DataFrame, n: int = 5) -> dict[str, pd.DataFrame]:
    """Hottest (mean Tmax anomaly vs same season type) and driest (rain) seasons."""
    s = st.reset_index()
    s["tmax_anom"] = s["tmax_mean"] - s.groupby("season")["tmax_mean"].transform("mean")
    hottest = s.sort_values("tmax_anom", ascending=False).head(n)
    winters = s[s["season"] == "W"]
    driest = winters.sort_values("rain_mm").head(n)
    return {"hottest": hottest, "driest": driest}
