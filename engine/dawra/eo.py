"""M1/M5 inputs — NASA & partner Earth observation via Google Earth Engine.

Every extractor caches its output under ``data/eo/`` (CSV / GeoJSON / PNG) and is skipped when the
cache exists, so ``make data`` is resumable. Auth: ``earthengine authenticate`` once, and
``GEE_PROJECT`` in the git-ignored ``.env`` (loaded with python-dotenv).
"""
from __future__ import annotations

import json
import os
import time
from datetime import date
from pathlib import Path
from typing import Any, Callable

import numpy as np
import pandas as pd
import requests

from .config import EO_DIR, ROOT, STATION_LAT, STATION_LON

AOI_BBOX = (32.65, 29.50, 32.80, 29.75)  # lon_min, lat_min, lon_max, lat_max — Ras Sudr plain
RAIN_BBOX = (32.30, 29.20, 33.30, 30.10)  # wider box so 0.1° IMERG pixels are visible on the map
CMIP6_MODELS = ("ACCESS-CM2", "MPI-ESM1-2-HR", "MRI-ESM2-0", "EC-Earth3", "GFDL-ESM4")
CMIP6_SCENARIOS = ("ssp245", "ssp585")
GRACE_IDS = ("NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI", "NASA/GRACE/MASS_GRIDS_V04/MASCON",
             "NASA/GRACE/MASS_GRIDS_V03/MASCON_CRI", "NASA/GRACE/MASS_GRIDS/MASCON_CRI")
FIELD_YEAR = 2025
DEG_10M = 10 / 111320.0
_EE: Any = None


class EOUnavailable(RuntimeError):
    """Raised when Earth Engine cannot be initialised."""


def ee_init() -> Any:
    """Initialise Earth Engine once with GEE_PROJECT from the environment / .env."""
    global _EE
    if _EE is not None:
        return _EE
    try:
        from dotenv import load_dotenv  # noqa: PLC0415

        load_dotenv(ROOT / ".env")
        import ee  # noqa: PLC0415

        ee.Initialize(project=os.getenv("GEE_PROJECT"))
        ee.Number(1).getInfo()
    except Exception as exc:  # noqa: BLE001
        raise EOUnavailable(
            "Earth Engine not available: run `earthengine authenticate`, set GEE_PROJECT in .env, then `make data`. "
            f"({type(exc).__name__}: {str(exc).splitlines()[0][:160] if str(exc) else ''})") from exc
    _EE = ee
    return ee


def _path(name: str) -> Path:
    EO_DIR.mkdir(parents=True, exist_ok=True)
    return EO_DIR / name


def cached(name: str) -> pd.DataFrame | None:
    """Read a cached EO CSV if it exists."""
    p = EO_DIR / name
    if not p.exists():
        return None
    df = pd.read_csv(p)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
    return df


def _retry(fn: Callable[[], Any], tries: int = 4) -> Any:
    for k in range(tries):
        try:
            return fn()
        except Exception:  # noqa: BLE001
            if k == tries - 1:
                raise
            time.sleep(4 * (k + 1))
    return None


def aoi(ee: Any):
    return ee.Geometry.Rectangle(list(AOI_BBOX))


def station_point(ee: Any, buffer_m: float = 0):
    p = ee.Geometry.Point([STATION_LON, STATION_LAT])
    return p.buffer(buffer_m) if buffer_m else p


def _region_series(ee: Any, col, geom, bands: list[str], scale: float, chunk: int = 300) -> pd.DataFrame:
    """Mean of ``bands`` over ``geom`` for every image of ``col`` → DataFrame(date, bands…)."""

    def feat(img):
        d = img.reduceRegion(ee.Reducer.mean(), geom, scale, maxPixels=1e9, bestEffort=True)
        return ee.Feature(None, d).set("date", img.date().format("YYYY-MM-dd"))

    n = _retry(lambda: col.size().getInfo())
    lst = col.toList(max(n, 1))
    rows: list[dict] = []
    for i in range(0, n, chunk):
        fc = ee.FeatureCollection(lst.slice(i, min(i + chunk, n)).map(lambda im: feat(ee.Image(im))))
        rows += [f["properties"] for f in _retry(lambda fc=fc: fc.getInfo())["features"]]
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["date", *bands])
    df["date"] = pd.to_datetime(df["date"])
    return df[["date", *[b for b in bands if b in df.columns]]].sort_values("date").reset_index(drop=True)


def _monthly(ee: Any, col, start: str, end: str, reducer: str = "mean"):
    """ImageCollection of monthly composites (property 'date' = first of month)."""
    d0 = ee.Date(start)
    n = int((pd.Timestamp(end).year - pd.Timestamp(start).year) * 12 + pd.Timestamp(end).month - pd.Timestamp(start).month)

    def mk(i):
        a = d0.advance(i, "month")
        sub = col.filterDate(a, a.advance(1, "month"))
        img = getattr(sub, reducer)()
        return img.set("system:time_start", a.millis()).set("n", sub.size())

    return ee.ImageCollection(ee.List.sequence(0, n - 1).map(mk)).filter(ee.Filter.gt("n", 0))


# --------------------------------------------------------------------------- NDVI sources
def s2_ndvi(ee: Any, geom, start: str, end: str):
    """Sentinel-2 SR harmonized NDVI, SCL-masked (keep vegetation, bare, water, unclassified)."""
    def prep(img):
        scl = img.select("SCL")
        ok = scl.eq(4).Or(scl.eq(5)).Or(scl.eq(6)).Or(scl.eq(7))
        return img.normalizedDifference(["B8", "B4"]).rename("ndvi").updateMask(ok).copyProperties(
            img, ["system:time_start"])
    return (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").filterBounds(geom).filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60)).map(prep))


def landsat_ndvi(ee: Any, geom, start: str, end: str):
    """Landsat 5/7/8/9 Collection-2 L2 NDVI, QA_PIXEL-masked (dilated cloud, cloud, shadow)."""
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


def ndvi_station(force: bool = False) -> pd.DataFrame:
    """Per-scene NDVI at the DRC station (150 m buffer), Landsat 1990+ and Sentinel-2 2017+, with 16-day max."""
    name = "ndvi_station.csv"
    if not force and (EO_DIR / name).exists():
        return cached(name)
    ee = ee_init()
    g = station_point(ee, 150)
    end = date.today().isoformat()
    s2 = _region_series(ee, s2_ndvi(ee, g, "2017-03-28", end), g, ["ndvi"], 10).assign(sensor="S2")
    ls = _region_series(ee, landsat_ndvi(ee, g, "1990-01-01", end), g, ["ndvi"], 30).assign(sensor="Landsat")
    df = pd.concat([s2, ls]).dropna(subset=["ndvi"]).sort_values("date")
    comp = df.set_index("date")["ndvi"].resample("16D").max().rename("ndvi_16d")
    out = df.merge(comp, left_on="date", right_index=True, how="outer").sort_values("date")
    out.to_csv(_path(name), index=False)
    return out


# --------------------------------------------------------------------------- vegetated area + overlays
def annual_ndvi_p90(ee: Any, year: int, geom):
    """Annual 90th-percentile Landsat NDVI (robust 'green at some point in the year')."""
    return landsat_ndvi(ee, geom, f"{year}-01-01", f"{year + 1}-01-01").select("ndvi").reduce(
        ee.Reducer.percentile([90])).rename("ndvi")


def vegetated_area_series(y0: int = 1990, y1: int = 2025, threshold: float = 0.1, force: bool = False) -> pd.DataFrame:
    """Area (ha) with annual P90 NDVI > threshold in the AOI for every year; S16 check in 1996 and 2022."""
    name = "vegetated_area.csv"
    old = cached(name) if not force else None
    done = set(old["year"]) if old is not None else set()
    ee = ee_init()
    g = aoi(ee)
    rows = old.to_dict("records") if old is not None else []
    for y in range(y0, y1 + 1):
        if y in done:
            continue
        img = annual_ndvi_p90(ee, y, g)
        veg = img.gt(threshold).selfMask()
        ha = veg.multiply(ee.Image.pixelArea()).divide(1e4).reduceRegion(ee.Reducer.sum(), g, 30, maxPixels=1e10,
                                                                         tileScale=4)
        n = landsat_ndvi(ee, g, f"{y}-01-01", f"{y + 1}-01-01").size()
        info = _retry(lambda: ee.Dictionary({"ha": ha.get("ndvi"), "n": n}).getInfo())
        rows.append({"date": f"{y}-12-31", "year": y, "vegetated_ha": info["ha"] or 0.0, "landsat_scenes": info["n"]})
        pd.DataFrame(rows).sort_values("year").to_csv(_path(name), index=False)
    return cached(name)


def _thumb(ee: Any, img, region, name: str, vis: dict, dims: int = 640) -> str:
    """Download a PNG overlay via getThumbURL (masked pixels transparent)."""
    p = _path(f"overlays/{name}.png")
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        return p.name
    url = _retry(lambda: img.getThumbURL({**vis, "region": region, "dimensions": dims, "format": "png"}))
    r = _retry(lambda: requests.get(url, timeout=120))
    r.raise_for_status()
    p.write_bytes(r.content)
    return p.name


NDVI_VIS = {"min": 0.1, "max": 0.6, "palette": ["d9f0a3", "addd8e", "78c679", "31a354", "006837"]}


def overlays(years: range = range(1990, 2026)) -> dict:
    """PNG layers for the web map: NDVI per year, summer LST, slope, mean annual rain."""
    ee = ee_init()
    g = aoi(ee)
    meta: dict[str, Any] = {"aoi_bbox": list(AOI_BBOX), "rain_bbox": list(RAIN_BBOX), "ndvi": {}}
    for y in years:
        img = annual_ndvi_p90(ee, y, g)
        meta["ndvi"][str(y)] = _thumb(ee, img.updateMask(img.gt(0.1)), g, f"ndvi_{y}", NDVI_VIS, 560)
    lst = (ee.ImageCollection("MODIS/061/MOD11A2").filterDate("2020-01-01", "2026-01-01")
           .filter(ee.Filter.calendarRange(6, 9, "month")).select("LST_Day_1km").mean().multiply(0.02).subtract(273.15))
    meta["lst"] = _thumb(ee, lst, g, "lst_summer", {"min": 38, "max": 52, "palette": ["fee08b", "fdae61", "f46d43",
                                                                                         "d73027", "a50026"]}, 400)
    dem = ee.Image("USGS/SRTMGL1_003")
    slope = ee.Terrain.slope(dem)
    meta["slope"] = _thumb(ee, slope.updateMask(slope.gt(0.5)), g, "slope",
                           {"min": 0.5, "max": 8, "palette": ["f7fbff", "9ecae1", "4292c6", "08519c", "08306b"]}, 560)
    rain = (ee.ImageCollection("NASA/GPM_L3/IMERG_MONTHLY_V07").filterDate("2001-01-01", "2026-01-01")
            .select("precipitation").mean().multiply(24 * 365.25))  # mm/h mean → mm/yr
    meta["rain"] = _thumb(ee, rain, ee.Geometry.Rectangle(list(RAIN_BBOX)), "rain_annual",
                          {"min": 10, "max": 80, "palette": ["f7fbff", "c6dbef", "6baed6", "2171b5", "08306b"]}, 300)
    (EO_DIR / "overlays" / "overlays.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    return meta


# --------------------------------------------------------------------------- field polygons
def field_mask_array(year: int = FIELD_YEAR) -> tuple[np.ndarray, tuple[float, float, float, float]]:
    """Cropped-field mask on a 10 m lon/lat grid: S2 NDVI amplitude (P90−P10) > 0.15 and P90 > 0.25."""
    ee = ee_init()
    g = aoi(ee)
    col = s2_ndvi(ee, g, f"{year}-01-01", f"{year + 1}-01-01").select("ndvi")
    pc = col.reduce(ee.Reducer.percentile([10, 90]))
    mask = pc.select("ndvi_p90").subtract(pc.select("ndvi_p10")).gt(0.15).And(pc.select("ndvi_p90").gt(0.25))
    lon0, lat0, lon1, lat1 = AOI_BBOX
    w, h = int(round((lon1 - lon0) / DEG_10M)), int(round((lat1 - lat0) / DEG_10M))
    tiles = []
    th = h // 2
    for k, (r0, rh) in enumerate(((0, th), (th, h - th))):
        top = lat1 - r0 * DEG_10M
        req = {"expression": mask.unmask(0).toByte(), "fileFormat": "NUMPY_NDARRAY",
               "grid": {"dimensions": {"width": w, "height": rh},
                        "affineTransform": {"scaleX": DEG_10M, "shearX": 0, "translateX": lon0,
                                            "shearY": 0, "scaleY": -DEG_10M, "translateY": top},
                        "crsCode": "EPSG:4326"}}
        arr = _retry(lambda req=req: ee.data.computePixels(req))
        tiles.append(np.array(arr.tolist() if arr.dtype.names is None else arr[arr.dtype.names[0]]).astype(np.uint8))
    return np.vstack(tiles), (lon0, lat1, DEG_10M, DEG_10M)


def vectorize(mask: np.ndarray, transform: tuple[float, float, float, float], min_ha: float = 0.5,
              simplify_m: float = 8.0) -> dict:
    """Mask → GeoJSON polygons (contourpy filled contours + shapely), area-filtered and simplified."""
    import contourpy  # noqa: PLC0415
    from shapely.geometry import Polygon, mapping  # noqa: PLC0415
    from shapely.validation import make_valid  # noqa: PLC0415

    lon0, lat_top, dx, dy = transform
    z = np.pad(mask.astype(float), 1)
    gen = contourpy.contour_generator(z=z, fill_type=contourpy.FillType.OuterOffset)
    polys, offsets = gen.filled(0.5, 1.5)
    feats = []
    mlat = np.cos(np.deg2rad(29.62))
    for pts, offs in zip(polys, offsets):
        rings = [pts[offs[i]:offs[i + 1]] for i in range(len(offs) - 1)]
        conv = [[(lon0 + (c - 1) * dx, lat_top - (r - 1) * dy) for c, r in ring] for ring in rings]
        if len(conv[0]) < 4:
            continue
        poly = make_valid(Polygon(conv[0], [h for h in conv[1:] if len(h) >= 4]))
        area_ha = poly.area * (111320.0 ** 2) * mlat / 1e4
        if area_ha < min_ha:
            continue
        poly = poly.simplify(simplify_m / 111320.0, preserve_topology=True)
        c = poly.centroid
        feats.append({"type": "Feature", "geometry": mapping(poly),
                      "properties": {"area_ha": round(area_ha, 2), "lon": round(c.x, 5), "lat": round(c.y, 5)}})
    feats.sort(key=lambda f: -f["properties"]["area_ha"])
    for i, f in enumerate(feats):
        f["properties"]["field_id"] = f"FLD{i + 1:04d}"
    return {"type": "FeatureCollection", "features": feats}


def _round_coords(geom: dict, nd: int = 5) -> dict:
    def rnd(x):
        return [rnd(v) for v in x] if isinstance(x, (list, tuple)) else round(x, nd)
    return {**geom, "coordinates": rnd(geom["coordinates"])}


def field_candidates(year: int = FIELD_YEAR, force: bool = False) -> dict:
    """Field polygons (≥ 0.5 ha) for ``year`` → data/eo/fields_<year>.geojson."""
    p = _path(f"fields_{year}.geojson")
    if p.exists() and not force:
        return json.loads(p.read_text(encoding="utf-8"))
    mask, tr = field_mask_array(year)
    gj = vectorize(mask, tr)
    for f in gj["features"]:
        f["geometry"] = _round_coords(f["geometry"])
    p.write_text(json.dumps(gj), encoding="utf-8")
    return gj


def field_ndvi_monthly(year: int = FIELD_YEAR, force: bool = False) -> pd.DataFrame:
    """Monthly max S2 NDVI 2017→ for every field polygon (reduceRegions)."""
    name = "field_ndvi_monthly.csv"
    if not force and (EO_DIR / name).exists():
        return cached(name)
    ee = ee_init()
    gj = field_candidates(year)
    fc = ee.FeatureCollection([ee.Feature(ee.Geometry(f["geometry"]), {"field_id": f["properties"]["field_id"]})
                               for f in gj["features"]])
    end = date.today().replace(day=1).isoformat()
    mon = _monthly(ee, s2_ndvi(ee, aoi(ee), "2017-04-01", end).select("ndvi"), "2017-04-01", end, "max")
    imgs = mon.toList(200)
    n = _retry(lambda: mon.size().getInfo())
    rows = []
    for i in range(n):
        img = ee.Image(imgs.get(i))
        red = img.reduceRegions(fc, ee.Reducer.mean(), 10, tileScale=4).map(
            lambda f, img=img: ee.Feature(None, {"field_id": f.get("field_id"), "ndvi": f.get("mean"),
                                                 "date": ee.Date(img.get("system:time_start")).format("YYYY-MM-dd")}))
        rows += [f["properties"] for f in _retry(lambda red=red: red.getInfo())["features"]]
    df = pd.DataFrame(rows).dropna(subset=["ndvi"])
    df["date"] = pd.to_datetime(df["date"])
    df.to_csv(_path(name), index=False)
    return df


def field_terrain(year: int = FIELD_YEAR, force: bool = False) -> pd.DataFrame:
    """Mean elevation and slope per field (SRTM 30 m)."""
    name = "field_terrain.csv"
    if not force and (EO_DIR / name).exists():
        return cached(name)
    ee = ee_init()
    gj = field_candidates(year)
    fc = ee.FeatureCollection([ee.Feature(ee.Geometry(f["geometry"]), {"field_id": f["properties"]["field_id"]})
                               for f in gj["features"]])
    dem = ee.Image("USGS/SRTMGL1_003")
    img = dem.rename("elev").addBands(ee.Terrain.slope(dem).rename("slope"))
    red = img.reduceRegions(fc, ee.Reducer.mean(), 30)
    df = pd.DataFrame([f["properties"] for f in _retry(lambda: red.getInfo())["features"]])
    df.to_csv(_path(name), index=False)
    return df


# --------------------------------------------------------------------------- NASA point products
def smap_rootzone(force: bool = False) -> pd.DataFrame:
    """SMAP L4 (v008) surface & root-zone soil moisture (m³/m³), monthly mean at the station."""
    name = "smap_station.csv"
    if not force and (EO_DIR / name).exists():
        return cached(name)
    ee = ee_init()
    end = date.today().replace(day=1).isoformat()
    col = ee.ImageCollection("NASA/SMAP/SPL4SMGP/008").select(["sm_surface", "sm_rootzone"])
    mon = _monthly(ee, col, "2015-04-01", end)
    df = _region_series(ee, mon, station_point(ee), ["sm_surface", "sm_rootzone"], 11000)
    df.to_csv(_path(name), index=False)
    return df


def imerg_daily(start_year: int = 2001, end_year: int = 2025, force: bool = False) -> pd.DataFrame:
    """GPM IMERG V07 daily precipitation (mm) at the station (sum of half-hourly mm/h × 0.5)."""
    name = "imerg_station.csv"
    old = cached(name) if not force else None
    have = set(old["date"].dt.year) if old is not None else set()
    ee = ee_init()
    pt = station_point(ee)
    col = ee.ImageCollection("NASA/GPM_L3/IMERG_V07").select("precipitation")
    rows = old.to_dict("records") if old is not None else []
    for y in range(start_year, end_year + 1):
        if y in have:
            continue
        d0 = ee.Date(f"{y}-01-01")
        n = 366 if pd.Timestamp(y, 12, 31).dayofyear == 366 else 365

        def daily(i, d0=d0):
            d = d0.advance(i, "day")
            v = col.filterDate(d, d.advance(1, "day")).sum().multiply(0.5).reduceRegion(
                ee.Reducer.mean(), pt, 11132).get("precipitation")
            return ee.Feature(None, {"date": d.format("YYYY-MM-dd"), "precip_mm": v})

        fc = ee.FeatureCollection(ee.List.sequence(0, n - 1).map(daily))
        rows += [f["properties"] for f in _retry(lambda fc=fc: fc.getInfo())["features"]]
        df = pd.DataFrame(rows)
        df["date"] = pd.to_datetime(df["date"])
        df.sort_values("date").to_csv(_path(name), index=False)
    return cached(name)


def imerg_heavy_days(df: pd.DataFrame) -> pd.DataFrame:
    """Annual count of days > 10 mm and > 20 mm, and annual total."""
    g = df.groupby(df["date"].dt.year)["precip_mm"]
    return pd.DataFrame({"days_gt10": g.apply(lambda s: int((s > 10).sum())),
                         "days_gt20": g.apply(lambda s: int((s > 20).sum())), "annual_mm": g.sum()})


def modis_lst_et(force: bool = False) -> pd.DataFrame:
    """MOD11A2 daytime LST (°C) and MOD16A2GF ET (mm per 8 days) at the station."""
    name = "modis_station.csv"
    if not force and (EO_DIR / name).exists():
        return cached(name)
    ee = ee_init()
    pt = station_point(ee)
    lst = ee.ImageCollection("MODIS/061/MOD11A2").select("LST_Day_1km").map(
        lambda i: i.multiply(0.02).subtract(273.15).rename("lst_c").copyProperties(i, ["system:time_start"]))
    et = ee.ImageCollection("MODIS/061/MOD16A2GF").select("ET").map(
        lambda i: i.multiply(0.1).rename("et_mm_8d").copyProperties(i, ["system:time_start"]))
    a = _region_series(ee, lst, pt, ["lst_c"], 1000)
    b = _region_series(ee, et, pt, ["et_mm_8d"], 500)
    out = pd.merge(a, b, on="date", how="outer").sort_values("date")
    out.to_csv(_path(name), index=False)
    return out


def srtm_aoi(force: bool = False) -> pd.DataFrame:
    """Mean/max slope (°) and elevation (m) of the AOI from SRTM 30 m."""
    name = "srtm_aoi.csv"
    if not force and (EO_DIR / name).exists():
        return cached(name)
    ee = ee_init()
    dem = ee.Image("USGS/SRTMGL1_003")
    img = dem.rename("elev").addBands(ee.Terrain.slope(dem).rename("slope"))
    red = ee.Reducer.mean().combine(ee.Reducer.max(), sharedInputs=True)
    stats = _retry(lambda: img.reduceRegion(red, aoi(ee), 30, maxPixels=1e10).getInfo())
    out = pd.DataFrame([{"date": "2000-02-11", **stats}])
    out.to_csv(_path(name), index=False)
    return out


def grace_trend(force: bool = False) -> pd.DataFrame:
    """GRACE/GRACE-FO mascon LWE thickness (cm), monthly at the station (first available collection id)."""
    name = "grace_station.csv"
    if not force and (EO_DIR / name).exists():
        return cached(name)
    ee = ee_init()
    for cid in GRACE_IDS:
        try:
            col = ee.ImageCollection(cid).select("lwe_thickness")
            if _retry(lambda col=col: col.size().getInfo()) > 0:
                break
        except Exception:  # noqa: BLE001
            continue
    else:
        raise EOUnavailable("no GRACE mascon collection found")
    df = _region_series(ee, col, station_point(ee), ["lwe_thickness"], 55000).assign(collection=cid)
    df.to_csv(_path(name), index=False)
    return df


def linear_trend(df: pd.DataFrame, col: str) -> float:
    """Least-squares slope per year of ``col`` against ``date``."""
    d = df.dropna(subset=[col])
    if len(d) < 3:
        return float("nan")
    t = (d["date"] - d["date"].min()).dt.days / 365.25
    return float(np.polyfit(t, d[col], 1)[0])


def cmip6_deltas(force: bool = False) -> pd.DataFrame:
    """NEX-GDDP-CMIP6 monthly deltas 2041–2060 vs 1995–2014 at the station: tas, tasmax (°C), pr (%)."""
    name = "cmip6_deltas.csv"
    if not force and (EO_DIR / name).exists():
        return cached(name)
    ee = ee_init()
    pt = station_point(ee)
    col = ee.ImageCollection("NASA/GDDP-CMIP6")

    def clim(model: str, scen: str, y0: int, y1: int) -> pd.DataFrame:
        c = (col.filter(ee.Filter.eq("model", model)).filter(ee.Filter.eq("scenario", scen))
             .filterDate(f"{y0}-01-01", f"{y1 + 1}-01-01").select(["tas", "tasmax", "pr"]))

        def per_month(m):
            v = c.filter(ee.Filter.calendarRange(m, m, "month")).mean().reduceRegion(ee.Reducer.mean(), pt, 27830)
            return ee.Feature(None, v).set("month", m)

        fc = ee.FeatureCollection(ee.List.sequence(1, 12).map(per_month))
        return pd.DataFrame([f["properties"] for f in _retry(lambda: fc.getInfo())["features"]]).set_index("month")

    rows = []
    for model in CMIP6_MODELS:
        hist = clim(model, "historical", 1995, 2014)
        for scen in CMIP6_SCENARIOS:
            fut = clim(model, scen, 2041, 2060)
            for m in range(1, 13):
                rows.append({"model": model, "scenario": scen, "month": m,
                             "d_tas": fut.at[m, "tas"] - hist.at[m, "tas"],
                             "d_tasmax": fut.at[m, "tasmax"] - hist.at[m, "tasmax"],
                             "d_pr_pct": (fut.at[m, "pr"] / hist.at[m, "pr"] - 1) * 100 if hist.at[m, "pr"] > 0 else 0.0})
    df = pd.DataFrame(rows).assign(date="2050-01-01")
    df.to_csv(_path(name), index=False)
    return df


def cmip6_ensemble(df: pd.DataFrame | None = None) -> dict[str, dict[str, list[float]]]:
    """Ensemble-mean monthly deltas per scenario: {'ssp245': {'d_t': [12], 'rain_scale': [12]}, …}."""
    df = cached("cmip6_deltas.csv") if df is None else df
    if df is None or df.empty:
        return {}
    out = {}
    for scen, sub in df.groupby("scenario"):
        m = sub.groupby("month")[["d_tasmax", "d_pr_pct"]].mean().reindex(range(1, 13))
        # very dry months have unstable % changes; clip to ±60 %
        out[scen] = {"d_t": m["d_tasmax"].round(3).tolist(),
                     "rain_scale": (1 + m["d_pr_pct"].clip(-60, 60) / 100).round(3).tolist()}
    return out


# --------------------------------------------------------------------------- orchestration
EXTRACTORS: dict[str, Callable[[], Any]] = {
    "ndvi_station": ndvi_station, "vegetated_area": vegetated_area_series, "fields": field_candidates,
    "field_ndvi": field_ndvi_monthly, "field_terrain": field_terrain, "overlays": overlays, "smap": smap_rootzone,
    "imerg": imerg_daily, "modis": modis_lst_et, "srtm": srtm_aoi, "grace": grace_trend, "cmip6": cmip6_deltas,
}


def extract_all(only: list[str] | None = None) -> dict[str, Any]:
    """Run every extractor (cached ones are skipped); never raises."""
    try:
        ee_init()
    except EOUnavailable as exc:
        have = sorted(p.name for p in EO_DIR.glob("*.*")) if EO_DIR.exists() else []
        return {"status": "pending" if not have else "cached", "message": str(exc), "files": have}
    done, failed = [], {}
    for key, fn in EXTRACTORS.items():
        if only and key not in only:
            continue
        t0 = time.time()
        try:
            fn()
            done.append(key)
            print(f"  ✓ {key} ({time.time() - t0:.0f} s)", flush=True)
        except Exception as exc:  # noqa: BLE001
            failed[key] = f"{type(exc).__name__}: {str(exc)[:300]}"
            print(f"  ✗ {key}: {failed[key]}", flush=True)
    return {"status": "ok" if not failed else "partial", "done": done, "failed": failed,
            "message": f"{len(done)} products extracted", "files": sorted(p.name for p in EO_DIR.glob("*.*"))}


def eo_status() -> str:
    """'ok' if the key EO caches exist, else 'pending'."""
    need = ["ndvi_station.csv", "vegetated_area.csv", "smap_station.csv", "imerg_station.csv", "modis_station.csv"]
    return "ok" if all((EO_DIR / n).exists() for n in need) else "pending"


if __name__ == "__main__":
    import sys
    print(extract_all(sys.argv[1:] or None))
