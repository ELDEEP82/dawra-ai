"""M1/M5 inputs — NASA & partner Earth observation via Google Earth Engine (Prompt 2).

Every extractor returns a pandas DataFrame and caches a CSV under ``data/eo/``. When Earth
Engine is not authenticated, :func:`extract_all` returns ``status='pending'`` and the rest of
the pipeline keeps working (cached CSVs are used if present).

Run once:  ``earthengine authenticate`` then set ``GEE_PROJECT`` and ``make data``.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .config import EO_DIR, STATION_LAT, STATION_LON

AOI_BBOX = (32.65, 29.50, 32.80, 29.75)  # lon_min, lat_min, lon_max, lat_max — Ras Sudr plain
CMIP6_MODELS = ("ACCESS-CM2", "MPI-ESM1-2-HR", "MRI-ESM2-0")
CMIP6_SCENARIOS = ("ssp245", "ssp585")
_EE: Any = None


class EOUnavailable(RuntimeError):
    """Raised when Earth Engine cannot be initialised."""


def ee_init() -> Any:
    """Initialise Earth Engine once with ``GEE_PROJECT``; raise :class:`EOUnavailable` otherwise."""
    global _EE
    if _EE is not None:
        return _EE
    try:
        import ee  # noqa: PLC0415

        ee.Initialize(project=os.getenv("GEE_PROJECT"))
        ee.Number(1).getInfo()
    except Exception as exc:  # noqa: BLE001 - any auth/network error means 'pending'
        raise EOUnavailable(
            "Earth Engine not available: run `earthengine authenticate`, set GEE_PROJECT, then `make data`. "
            f"({type(exc).__name__}: {str(exc).splitlines()[0][:160]})") from exc
    _EE = ee
    return ee


def _cache(name: str) -> Path:
    EO_DIR.mkdir(parents=True, exist_ok=True)
    return EO_DIR / name


def cached(name: str) -> pd.DataFrame | None:
    """Read a cached EO CSV if it exists."""
    p = EO_DIR / name
    return pd.read_csv(p, parse_dates=["date"]) if p.exists() else None


# --------------------------------------------------------------------------- geometry helpers
def aoi(ee: Any):
    """Ras Sudr agricultural plain bbox."""
    return ee.Geometry.Rectangle(list(AOI_BBOX))


def station_point(ee: Any, buffer_m: float = 0):
    """DRC station point (optionally buffered)."""
    p = ee.Geometry.Point([STATION_LON, STATION_LAT])
    return p.buffer(buffer_m) if buffer_m else p


def _region_series(ee: Any, col, geom, bands: list[str], scale: float, chunk: int = 400) -> pd.DataFrame:
    """Mean of ``bands`` over ``geom`` for every image of ``col`` → DataFrame(date, bands…)."""

    def feat(img):
        d = img.reduceRegion(ee.Reducer.mean(), geom, scale, maxPixels=1e9, bestEffort=True)
        return ee.Feature(None, d).set("date", img.date().format("YYYY-MM-dd"))

    n = col.size().getInfo()
    lst = col.toList(n)
    rows: list[dict] = []
    for i in range(0, n, chunk):
        fc = ee.FeatureCollection(lst.slice(i, min(i + chunk, n)).map(lambda im: feat(ee.Image(im))))
        rows += [f["properties"] for f in fc.getInfo()["features"]]
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["date", *bands])
    df["date"] = pd.to_datetime(df["date"])
    return df[["date", *[b for b in bands if b in df.columns]]].sort_values("date").reset_index(drop=True)


# --------------------------------------------------------------------------- 1 NDVI
def _s2(ee: Any, geom, start: str, end: str):
    def prep(img):
        scl = img.select("SCL")
        ok = scl.eq(4).Or(scl.eq(5)).Or(scl.eq(6)).Or(scl.eq(7))
        return img.normalizedDifference(["B8", "B4"]).rename("ndvi").updateMask(ok).copyProperties(img, ["system:time_start"])
    return (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(geom).filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60)).map(prep))


def _landsat(ee: Any, geom, start: str, end: str):
    def prep(nir: str, red: str):
        def f(img):
            qa = img.select("QA_PIXEL")
            clear = qa.bitwiseAnd(1 << 1).eq(0).And(qa.bitwiseAnd(1 << 3).eq(0)).And(qa.bitwiseAnd(1 << 4).eq(0))
            sr = img.select([nir, red]).multiply(0.0000275).add(-0.2)
            return sr.normalizedDifference([nir, red]).rename("ndvi").updateMask(clear).copyProperties(
                img, ["system:time_start"])
        return f
    cols = [("LANDSAT/LT05/C02/T1_L2", "SR_B4", "SR_B3"), ("LANDSAT/LE07/C02/T1_L2", "SR_B4", "SR_B3"),
            ("LANDSAT/LC08/C02/T1_L2", "SR_B5", "SR_B4"), ("LANDSAT/LC09/C02/T1_L2", "SR_B5", "SR_B4")]
    merged = None
    for cid, nir, red in cols:
        c = ee.ImageCollection(cid).filterBounds(geom).filterDate(start, end).map(prep(nir, red))
        merged = c if merged is None else merged.merge(c)
    return merged


def ndvi_timeseries(geom=None, start: str = "1990-01-01", end: str = "2026-10-01", name: str = "ndvi_station") -> pd.DataFrame:
    """NDVI per scene (Sentinel-2 2017+, Landsat 5/7/8/9 1990+) + a 16-day composite column."""
    ee = ee_init()
    geom = geom or station_point(ee, 150)
    s2 = _region_series(ee, _s2(ee, geom, max(start, "2017-03-28"), end), geom, ["ndvi"], 10).assign(sensor="S2")
    ls = _region_series(ee, _landsat(ee, geom, start, end), geom, ["ndvi"], 30).assign(sensor="Landsat")
    df = pd.concat([s2, ls]).dropna(subset=["ndvi"]).sort_values("date")
    comp = df.set_index("date")["ndvi"].resample("16D").max().rename("ndvi_16d")
    out = df.merge(comp, left_on="date", right_index=True, how="outer").sort_values("date")
    out.to_csv(_cache(f"{name}.csv"), index=False)
    return out


# --------------------------------------------------------------------------- 2 vegetated area, 3 fields
def _annual_max_ndvi(ee: Any, year: int, geom):
    s, e = f"{year}-01-01", f"{year + 1}-01-01"
    col = _landsat(ee, geom, s, e).merge(_s2(ee, geom, s, e)) if year >= 2017 else _landsat(ee, geom, s, e)
    return col.select("ndvi").max()


def vegetated_area(year: int = 2022) -> pd.DataFrame:
    """Area (ha) with annual max NDVI > 0.1 in the AOI — validated against 1,579 ha in 2022 (S16)."""
    ee = ee_init()
    g = aoi(ee)
    veg = _annual_max_ndvi(ee, year, g).gt(0.1)
    ha = veg.multiply(ee.Image.pixelArea()).divide(1e4).reduceRegion(ee.Reducer.sum(), g, 30, maxPixels=1e10)
    out = pd.DataFrame([{"date": f"{year}-12-31", "year": year, "vegetated_ha": list(ha.getInfo().values())[0]}])
    out.to_csv(_cache(f"vegetated_area_{year}.csv"), index=False)
    return out


def field_candidates(year: int = 2024, min_ha: float = 0.5) -> pd.DataFrame:
    """Vectorise pixels with seasonal NDVI amplitude > 0.15 into field polygons (≥ min_ha) → GeoJSON."""
    ee = ee_init()
    g = aoi(ee)
    s, e = f"{year}-01-01", f"{year + 1}-01-01"
    col = _s2(ee, g, s, e).select("ndvi")
    amp = col.max().subtract(col.min())
    mask = amp.gt(0.15).selfMask().rename("field")
    vec = mask.reduceToVectors(geometry=g, scale=10, geometryType="polygon", maxPixels=1e10, bestEffort=True)
    vec = vec.map(lambda f: f.set("area_ha", f.geometry().area(1).divide(1e4))).filter(ee.Filter.gte("area_ha", min_ha))
    gj = vec.getInfo()
    for i, f in enumerate(gj["features"]):
        f["properties"]["field_id"] = f"FLD{i + 1:04d}"
    _cache(f"fields_{year}.geojson").write_text(json.dumps(gj), encoding="utf-8")
    return pd.DataFrame([{**f["properties"]} for f in gj["features"]])


# --------------------------------------------------------------------------- 4–8 NASA point products
def smap_rootzone(point=None) -> pd.DataFrame:
    """SMAP L4 surface & root-zone soil moisture (m³/m³), daily mean of the 3-hourly product."""
    ee = ee_init()
    pt = point or station_point(ee)
    col = ee.ImageCollection("NASA/SMAP/SPL4SMGP/008").select(["sm_surface", "sm_rootzone"])
    df = _region_series(ee, col.filterDate("2015-04-01", "2026-10-01"), pt, ["sm_surface", "sm_rootzone"], 11000)
    out = df.set_index("date").resample("D").mean().reset_index()
    out.to_csv(_cache("smap_station.csv"), index=False)
    return out


def imerg_daily(point=None, start: str = "2001-01-01", end: str = "2026-10-01") -> pd.DataFrame:
    """GPM IMERG V07 daily precipitation (mm) + annual counts of days > 10 and > 20 mm (in df.attrs)."""
    ee = ee_init()
    pt = point or station_point(ee)
    col = ee.ImageCollection("NASA/GPM_L3/IMERG_V07").select("precipitation")
    days = pd.date_range(start, end, freq="D")
    rows = []
    for y in sorted(set(days.year)):
        d0 = ee.Date(f"{y}-01-01")
        n = 366 if pd.Timestamp(y, 12, 31).dayofyear == 366 else 365

        def daily(i, d0=d0):
            d = d0.advance(i, "day")
            img = col.filterDate(d, d.advance(1, "day")).sum().multiply(0.5)  # mm/h × 0.5 h
            v = img.reduceRegion(ee.Reducer.mean(), pt, 11000).get("precipitation")
            return ee.Feature(None, {"date": d.format("YYYY-MM-dd"), "precip_mm": v})

        fc = ee.FeatureCollection(ee.List.sequence(0, n - 1).map(daily))
        rows += [f["properties"] for f in fc.getInfo()["features"]]
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df.to_csv(_cache("imerg_station.csv"), index=False)
    return df


def imerg_heavy_days(df: pd.DataFrame) -> pd.DataFrame:
    """Annual count of days > 10 mm and > 20 mm."""
    g = df.groupby(df["date"].dt.year)["precip_mm"]
    return pd.DataFrame({"days_gt10": g.apply(lambda s: int((s > 10).sum())),
                         "days_gt20": g.apply(lambda s: int((s > 20).sum())), "annual_mm": g.sum()})


def modis_lst_et(point=None) -> pd.DataFrame:
    """MOD11A2 daytime LST (°C) and MOD16A2GF ET (mm per 8 days)."""
    ee = ee_init()
    pt = point or station_point(ee)
    lst = ee.ImageCollection("MODIS/061/MOD11A2").select("LST_Day_1km").map(
        lambda i: i.multiply(0.02).subtract(273.15).rename("lst_c").copyProperties(i, ["system:time_start"]))
    et = ee.ImageCollection("MODIS/061/MOD16A2GF").select("ET").map(
        lambda i: i.multiply(0.1).rename("et_mm_8d").copyProperties(i, ["system:time_start"]))
    a = _region_series(ee, lst, pt, ["lst_c"], 1000)
    b = _region_series(ee, et, pt, ["et_mm_8d"], 500)
    out = pd.merge(a, b, on="date", how="outer").sort_values("date")
    out.to_csv(_cache("modis_station.csv"), index=False)
    return out


def srtm_slope(geom=None) -> pd.DataFrame:
    """Mean/max slope (°) and elevation (m) from SRTM 30 m."""
    ee = ee_init()
    g = geom or aoi(ee)
    dem = ee.Image("USGS/SRTMGL1_003")
    img = dem.rename("elev").addBands(ee.Terrain.slope(dem).rename("slope"))
    red = ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True)
    stats = img.reduceRegion(red, g, 30, maxPixels=1e10).getInfo()
    out = pd.DataFrame([{"date": "2000-02-11", **stats}])
    out.to_csv(_cache("srtm_aoi.csv"), index=False)
    return out


def grace_trend(point=None) -> pd.DataFrame:
    """GRACE/GRACE-FO mascon LWE thickness (cm) monthly; trend (cm/yr) in df.attrs['trend_cm_yr']."""
    ee = ee_init()
    pt = point or station_point(ee)
    col = ee.ImageCollection("NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI").select("lwe_thickness")
    df = _region_series(ee, col, pt, ["lwe_thickness"], 55000)
    df.attrs["trend_cm_yr"] = linear_trend(df, "lwe_thickness")
    df.to_csv(_cache("grace_station.csv"), index=False)
    return df


def linear_trend(df: pd.DataFrame, col: str) -> float:
    """Least-squares slope per year of ``col`` against ``date``."""
    d = df.dropna(subset=[col])
    if len(d) < 3:
        return float("nan")
    t = (d["date"] - d["date"].min()).dt.days / 365.25
    return float(np.polyfit(t, d[col], 1)[0])


def cmip6_deltas(point=None) -> pd.DataFrame:
    """NASA GDDP-CMIP6 monthly deltas 2041–2060 vs 1995–2014: tas, tasmax (°C) and pr (%)."""
    ee = ee_init()
    pt = point or station_point(ee)
    col = ee.ImageCollection("NASA/GDDP-CMIP6")
    rows = []

    def clim(model: str, scen: str, y0: int, y1: int) -> pd.DataFrame:
        c = col.filter(ee.Filter.eq("model", model)).filter(ee.Filter.eq("scenario", scen)).filterDate(
            f"{y0}-01-01", f"{y1 + 1}-01-01").select(["tas", "tasmax", "pr"])
        out = []
        for m in range(1, 13):
            img = c.filter(ee.Filter.calendarRange(m, m, "month")).mean()
            v = img.reduceRegion(ee.Reducer.mean(), pt, 27830).getInfo()
            out.append({"month": m, **v})
        return pd.DataFrame(out).set_index("month")

    for model in CMIP6_MODELS:
        hist = clim(model, "historical", 1995, 2014)
        for scen in CMIP6_SCENARIOS:
            fut = clim(model, scen, 2041, 2060)
            for m in range(1, 13):
                rows.append({"model": model, "scenario": scen, "month": m,
                             "d_tas": fut.at[m, "tas"] - hist.at[m, "tas"],
                             "d_tasmax": fut.at[m, "tasmax"] - hist.at[m, "tasmax"],
                             "d_pr_pct": (fut.at[m, "pr"] / hist.at[m, "pr"] - 1) * 100 if hist.at[m, "pr"] else 0.0})
    df = pd.DataFrame(rows).assign(date="2050-01-01")
    df.to_csv(_cache("cmip6_deltas.csv"), index=False)
    return df


# --------------------------------------------------------------------------- orchestration
EXTRACTORS = {
    "ndvi_station": lambda: ndvi_timeseries(), "vegetated_area_2022": lambda: vegetated_area(2022),
    "fields": lambda: field_candidates(2024), "smap": smap_rootzone, "imerg": imerg_daily,
    "modis": modis_lst_et, "srtm": srtm_slope, "grace": grace_trend, "cmip6": cmip6_deltas,
}


def extract_all() -> dict[str, Any]:
    """Run every extractor; on missing auth return status 'pending' (never raises)."""
    try:
        ee_init()
    except EOUnavailable as exc:
        have = sorted(p.name for p in EO_DIR.glob("*.*")) if EO_DIR.exists() else []
        return {"status": "pending" if not have else "cached", "message": str(exc), "files": have}
    done, failed = [], {}
    for key, fn in EXTRACTORS.items():
        try:
            fn()
            done.append(key)
        except Exception as exc:  # noqa: BLE001 - keep going, report per product
            failed[key] = f"{type(exc).__name__}: {str(exc)[:200]}"
    return {"status": "ok" if not failed else "partial", "done": done, "failed": failed,
            "message": f"{len(done)} products extracted", "files": sorted(p.name for p in EO_DIR.glob("*.*"))}


def eo_status() -> str:
    """'ok' if the key EO caches exist, else 'pending' (used by the web export)."""
    need = ["ndvi_station.csv", "smap_station.csv", "imerg_station.csv"]
    return "ok" if all((EO_DIR / n).exists() for n in need) else "pending"
