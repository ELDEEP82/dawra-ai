"""M1 — loaders and harmonisation for the two raw files in ``data/raw``.

All header-row positions follow CLAUDE.md; the Crops sheet layout is detected
(row-per-crop in the delivered workbook, transposed per the original spec).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from .config import LOCAL_XLSX, POWER_CSV, PRICES_CSV

POWER_COLS = ["ALLSKY_SFC_SW_DWN", "T2M_MIN", "T2M_MAX", "TS", "RH2M", "WS2M", "GWETROOT", "PRECTOTCORR"]

CROP_NUMERIC = [
    "total_days", "Kc_ini", "Kc_mid", "Kc_end", "root_depth_m", "p_depletion",
    "ECe_100", "ECe_90", "ECe_75", "ECe_50", "ECe_0", "ECw_100", "ECw_90", "ECw_75", "ECw_50", "ECw_0",
]


# --------------------------------------------------------------------------- POWER
def load_power(path: Path = POWER_CSV) -> pd.DataFrame:
    """Load a NASA POWER daily CSV (header block, then ``YEAR,DOY,...``).

    Returns a DataFrame indexed by date with -999 replaced by NaN.
    """
    skip = _power_header_lines(path)
    df = pd.read_csv(path, skiprows=skip)
    df = df.replace(-999.0, np.nan).replace(-999, np.nan)
    idx = pd.to_datetime(df["YEAR"].astype(str), format="%Y") + pd.to_timedelta(df["DOY"] - 1, unit="D")
    df.index = pd.DatetimeIndex(idx, name="date")
    return df[[c for c in POWER_COLS if c in df.columns]].astype(float)


def _power_header_lines(path: Path) -> int:
    """Number of lines before the ``YEAR,DOY`` column row (16 for our file)."""
    with open(path, encoding="utf-8", errors="replace") as fh:
        for i, line in enumerate(fh):
            if line.startswith("YEAR,DOY"):
                return i
    raise ValueError(f"no YEAR,DOY header in {path}")


# --------------------------------------------------------------------------- seasons
def season_of(d: date | pd.Timestamp) -> tuple[str, int]:
    """Return ``('W', year_of_november)`` for Nov–Apr or ``('S', year)`` for May–Oct."""
    m, y = d.month, d.year
    if m >= 11:
        return "W", y
    if m <= 4:
        return "W", y - 1
    return "S", y


def season_labels(index: pd.DatetimeIndex) -> pd.DataFrame:
    """Vectorised :func:`season_of` → columns ``season`` and ``season_year``."""
    m = index.month
    y = index.year
    season = np.where((m >= 11) | (m <= 4), "W", "S")
    syear = np.where(m <= 4, y - 1, y)
    return pd.DataFrame({"season": season, "season_year": syear}, index=index)


def monthly(df: pd.DataFrame) -> pd.DataFrame:
    """Monthly aggregation: sums for precipitation/ET, means for the rest."""
    sums = [c for c in df.columns if c in ("PRECTOTCORR", "ET0", "Peff")]
    agg = {c: ("sum" if c in sums else "mean") for c in df.columns}
    out = df.resample("MS").agg(agg)
    counts = df.iloc[:, 0].resample("MS").count()
    return out[counts >= 25]


def seasonal(df: pd.DataFrame) -> pd.DataFrame:
    """Seasonal (W/S) aggregation; complete seasons only (>= 175 days)."""
    lab = season_labels(df.index)
    tmp = df.join(lab)
    sums = [c for c in df.columns if c in ("PRECTOTCORR", "ET0")]
    agg = {c: ("sum" if c in sums else "mean") for c in df.columns}
    g = tmp.groupby(["season_year", "season"])
    out = g.agg(agg)
    out["n_days"] = g.size()
    return out[out["n_days"] >= 175]


# --------------------------------------------------------------------------- crops
def _range_mean(v: object) -> float:
    """'1.0–1.5' → 1.25; numbers pass through; blanks → NaN."""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return np.nan
    if isinstance(v, (int, float, np.number)):
        return float(v)
    nums = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", str(v))]
    return float(np.mean(nums)) if nums else np.nan


def load_crops(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Tidy crop table, one row per ``crop_id`` (21 crops).

    The sheet is either row-per-crop (header row 3) or transposed (attribute
    names in column 3, crops in columns 4+); both are detected.
    """
    raw = pd.read_excel(xlsx, sheet_name="Crops", header=None)
    if str(raw.iat[3, 0]).strip() == "crop_id":
        df = raw.iloc[4:].copy()
        df.columns = [str(c).strip() for c in raw.iloc[3]]
    else:
        body = raw.iloc[:, 3:].dropna(axis=1, how="all")
        t = body.set_index(body.columns[0]).T
        df = t.copy()
        df.columns = [str(c).strip() for c in df.columns]
    df = df[df["crop_id"].notna() & df["crop_id"].astype(str).str.match(r"^[a-z_]+$")]
    df = df.dropna(axis=1, how="all").reset_index(drop=True)
    for c in CROP_NUMERIC:
        if c in df.columns:
            df[c] = df[c].map(_range_mean).astype(float)
    df["N_fixing"] = df["N_fixing"].astype(str).str.strip().str.lower().eq("yes")
    for c in ("crop_id", "crop_en", "family", "use", "season_ras_sudr", "salt_rating"):
        df[c] = df[c].where(df[c].notna(), None)
        df[c] = df[c].map(lambda s: s.strip() if isinstance(s, str) else s)
    return df.set_index("crop_id", drop=False)


# --------------------------------------------------------------------------- simple sheets
def _sheet_table(sheet: str, header_row: int, n_cols: int | None = None, xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Read a block whose header is at ``header_row``; stop at the first blank row."""
    raw = pd.read_excel(xlsx, sheet_name=sheet, header=None)
    hdr = raw.iloc[header_row]
    cols = [str(c).strip() for c in hdr if pd.notna(c)]
    ncol = n_cols or len(cols)
    body = raw.iloc[header_row + 1:, :ncol]
    blank = body.isna().all(axis=1)
    end = blank.values.argmax() if blank.any() else len(body)
    body = body.iloc[:end].copy()
    body.columns = cols[:ncol]
    return body.reset_index(drop=True)


def load_soil_baseline(xlsx: Path = LOCAL_XLSX) -> dict[str, float | str]:
    """Soil_Baseline sheet as ``{parameter: value}`` (numbers as float)."""
    tab = _sheet_table("Soil_Baseline", 3, 4, xlsx)
    out: dict[str, float | str] = {}
    for _, r in tab.iterrows():
        v = r["value"]
        try:
            out[str(r["parameter"])] = float(v)
        except (TypeError, ValueError):
            out[str(r["parameter"])] = str(v)
    return out


def load_local_yields(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Local_Yields sheet (header row 3)."""
    return _sheet_table("Local_Yields", 3, 6, xlsx)


def load_farmer_profiles(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Priority weights per profile (rows = criteria), normalised to sum 1 per profile."""
    tab = _sheet_table("Farmer_Priorities", 3, 8, xlsx)
    tab = tab[tab["criterion"].astype(str).ne("total (raw)")].set_index("criterion")
    w = tab.drop(columns=["label", "measured_by"]).astype(float)
    return w / w.sum(axis=0)


@dataclass(frozen=True)
class FarmProfile:
    """One farm from the Farmer_Priorities profile block."""

    farmer_id: str
    area_feddan: float
    well_ECw_dS_m: float
    water_m3_per_day: float
    irrigation_system: str
    livestock_heads: int
    last_crop: str
    preferred_crops: tuple[str, ...]
    avoid_crops: tuple[str, ...]
    budget_level: str
    labour_level: str
    market_channel: str


def load_farm_profile(farmer_id: str = "F001", xlsx: Path = LOCAL_XLSX) -> FarmProfile:
    """Farm profile row (header row 23, example row 24)."""
    tab = _sheet_table("Farmer_Priorities", 23, 12, xlsx)
    row = tab[tab["farmer_id"].astype(str) == farmer_id].iloc[0]

    def split(s: object) -> tuple[str, ...]:
        return tuple(x.strip() for x in str(s).split(";") if x.strip() and str(s) != "nan")

    return FarmProfile(
        farmer_id=str(row["farmer_id"]), area_feddan=float(row["area_feddan"]),
        well_ECw_dS_m=float(row["well_ECw_dS_m"]), water_m3_per_day=float(row["water_m3_per_day"]),
        irrigation_system=str(row["irrigation_system"]).strip(), livestock_heads=int(row["livestock_heads"]),
        last_crop=str(row["last_crop"]).strip(), preferred_crops=split(row["preferred_crops"]),
        avoid_crops=split(row["avoid_crops"]), budget_level=str(row["budget_level"]),
        labour_level=str(row["labour_level"]), market_channel=str(row["market_channel"]),
    )


def load_groundwater_zones(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Zone summary block (header row 47)."""
    tab = _sheet_table("Groundwater", 47, 7, xlsx)
    return tab.astype({"wells": int, "mean_ECw_dS_m": float, "share_>4000_mg_L": float})


def load_groundwater_wells(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """39 wells (header row 4)."""
    tab = _sheet_table("Groundwater", 4, 6, xlsx)
    return tab.astype({"TDS_mg_L": float, "ECw_est_dS_m": float})


def load_salinity_class_areas(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Area by groundwater salinity class, 1996 vs 2022 (header row 66, S16)."""
    tab = _sheet_table("Groundwater", 66, 7, xlsx)
    tab = tab[pd.to_numeric(tab["area_1996_ha"], errors="coerce").notna()].copy()
    for c in ("area_1996_ha", "share_1996", "area_2022_ha", "share_2022"):
        tab[c] = tab[c].astype(float)
    return tab


def load_s1_climate(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """S1 long-term (1983–2020) Nov–Apr Tmin/Tmax/Precip table from the Site sheet."""
    raw = pd.read_excel(xlsx, sheet_name="Site", header=None)
    start = raw.index[raw.iloc[:, 0].astype(str).eq("Month")][0]
    body = raw.iloc[start + 1:start + 7, :4].copy()
    body.columns = ["month", "tmin", "tmax", "precip"]
    body[["tmin", "tmax", "precip"]] = body[["tmin", "tmax", "precip"]].astype(float)
    month_num = {"Nov": 11, "Dec": 12, "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4}
    body["month_num"] = body["month"].map(month_num)
    return body.reset_index(drop=True)


def load_soil_water_measured(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Soil_Water_Measured (header row 3): one measurement per row with its source."""
    tab = _sheet_table("Soil_Water_Measured", 3, 7, xlsx)
    tab["value_num"] = pd.to_numeric(tab["Value"], errors="coerce")
    return tab


def measured_value(medium: str, parameter: str, source: str, xlsx: Path = LOCAL_XLSX) -> float:
    """One numeric measurement, e.g. ``measured_value('Water', 'EC', 'S4') == 7.94``."""
    t = load_soil_water_measured(xlsx)
    sel = t[(t["Medium"] == medium) & (t["Parameter"] == parameter) & (t["Source"] == source)]
    if sel.empty or sel["value_num"].isna().all():
        raise KeyError(f"no numeric {medium}/{parameter}/{source}")
    return float(sel["value_num"].dropna().iloc[0])


def load_aquifer_facts(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Aquifer and land-use facts (header row 74)."""
    return _sheet_table("Groundwater", 74, 4, xlsx)


def load_sources(xlsx: Path = LOCAL_XLSX) -> pd.DataFrame:
    """Sources S1–S18 with URLs (header row 2)."""
    return _sheet_table("Sources", 2, 3, xlsx)


def load_prices(path: Path = PRICES_CSV) -> pd.DataFrame:
    """Prices table; blank values stay NaN (never invented)."""
    df = pd.read_csv(path)
    for c in ("price_egp_per_ton", "cost_egp_per_feddan"):
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.set_index("crop_id")


def prices_available(prices: pd.DataFrame, crop_ids: list[str]) -> bool:
    """True only if every crop in ``crop_ids`` has both a price and a cost."""
    sub = prices.reindex(crop_ids)
    return bool(sub[["price_egp_per_ton", "cost_egp_per_feddan"]].notna().all().all())
