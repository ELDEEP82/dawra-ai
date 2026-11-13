"""Writes reports/02_eo.md and reports/04_evidence.md (status-aware: 'pending' until Earth Engine runs)."""
from __future__ import annotations

import pandas as pd

from .calibration import climate_daily
from .config import EO_DIR, REPORTS
from .reporting import md_table, new_fig, save_fig

EO_FILES = ["ndvi_station.csv", "smap_station.csv", "imerg_station.csv", "modis_station.csv", "srtm_aoi.csv",
            "grace_station.csv", "cmip6_deltas.csv"]
PRODUCTS = [
    ("NDVI", "Sentinel-2 SR harmonized (10 m, 2017+) + Landsat 5/7/8/9 C2 L2 (30 m, 1990+)", "COPERNICUS/S2_SR_HARMONIZED; LANDSAT/L*0*/C02/T1_L2", "field history, bare seasons, vegetated area"),
    ("Soil moisture", "SMAP L4 surface & root zone (9 km, 2015+)", "NASA/SMAP/SPL4SMGP/008", "drought context; coastal pixel mixing caveat"),
    ("Precipitation", "GPM IMERG V07 (0.1°, 2000+)", "NASA/GPM_L3/IMERG_V07", "heavy-rain days >10/>20 mm"),
    ("LST & ET", "MODIS MOD11A2 LST (1 km) + MOD16A2GF ET (500 m)", "MODIS/061/MOD11A2; MODIS/061/MOD16A2GF", "heat anomalies; ET0 cross-check"),
    ("Terrain", "SRTM 1 arc-second (30 m)", "USGS/SRTMGL1_003", "slope / elevation of fields"),
    ("Groundwater", "GRACE/GRACE-FO JPL/CSR mascons (~1°)", "NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI", "regional water-storage trend (coarse)"),
    ("Climate futures", "NASA NEX-GDDP-CMIP6 (0.25°)", "NASA/GDDP-CMIP6", "2041–2060 vs 1995–2014 deltas, SSP2-4.5 / SSP5-8.5"),
]


def gwetroot_chart() -> str:
    """Interim soil-moisture context: MERRA-2 GWETROOT monthly climatology (NASA POWER)."""
    df = climate_daily()
    mon = df["GWETROOT"].groupby(df.index.month).mean()
    fig, ax = new_fig(7, 3)
    ax.bar(mon.index, mon.values, color="#90be6d")
    ax.set_xticks(range(1, 13), list("JFMAMJJASOND"))
    ax.set_ylabel("root-zone wetness (0–1)")
    ax.set_title("Interim soil-moisture context — NASA POWER GWETROOT 1981–2026")
    return save_fig(fig, "02_gwetroot.png").as_posix()


def write_report(status: dict) -> None:
    """Write both EO reports for the given extraction status."""
    pending = status.get("status") in ("pending", None)
    prod = pd.DataFrame(PRODUCTS, columns=["product", "dataset", "Earth Engine id", "used for"])
    chart = gwetroot_chart()
    files = sorted(p.name for p in EO_DIR.glob("*.*")) if EO_DIR.exists() else []
    md = ["# 02 — NASA Earth observation (Earth Engine)", "",
          f"**Status: {status.get('status', 'pending').upper()}** — {status.get('message', '')}", "",
          "Code: `engine/dawra/eo.py` (all 9 extractors; batched `reduceRegion` requests; CSV cache in `data/eo/`). "
          "AOI: Ras Sudr plain, lon 32.65–32.80, lat 29.50–29.75; point products at the DRC station 29.5997 N 32.7014 E.", "",
          md_table(prod), "",
          "Caveats: SMAP 9 km and IMERG 0.1° pixels mix sea and land at this coastal site; GRACE (~300 km effective) "
          "sees the regional aquifer, not one well; CMIP6 0.25° is downscaled but still regional.", "",
          "## Interim context used while EO is pending", "",
          "NASA POWER MERRA-2 **GWETROOT** (root-zone soil wetness) is already in our POWER series and is shown in the "
          "app and cards as the soil-moisture context.", "", f"![gwetroot]({chart})", "",
          "## To finish", "", "```", "earthengine authenticate", "set GEE_PROJECT=<your-cloud-project>   # PowerShell: $env:GEE_PROJECT='…'",
          "make data      # or: python tasks.py data", "make build     # re-export the web JSON", "```", "",
          f"Cached EO files: {', '.join(files) if files else 'none yet'}."]
    (REPORTS / "02_eo.md").write_text("\n".join(md), encoding="utf-8")

    ev = ["# 04 — Evidence engine (NDVI phenology, M5)", "",
          f"**Status: {'PENDING (needs EO data)' if pending else 'see tables below'}**", "",
          "Implemented in `engine/dawra/evidence.py` and unit-tested on synthetic NDVI series "
          "(`tests/test_eo_evidence.py`):", "",
          "1. `phenology` — 16-day max composite → Savitzky–Golay (5, 2) → start/peak/end/amplitude/integral per season.",
          "2. `classify_season` — transparent rules (bare / winter_crop / summer_crop / perennial), then a KMeans "
          "consistency check (`kmeans_agreement`). No ground truth is invented.",
          "3. `bare_calendar` — share of years each season is bare.",
          "4. `vulnerable_seasons` — bottom-quartile NDVI peak AND worst-quartile heat / LST / SMAP anomaly.",
          "5. `current_rotation_guess` — most common W/S labels over the last 3 years (pre-fills the app; farmer confirms).",
          "6. `transition_evidence` — mean next-season NDVI peak after each previous label (exploratory caveat).",
          "7. `vegetated_area_check` — EO area with NDVI > 0.1 vs **1,579 ha in 2022 (S16)**, pass if within ±25 %.", "",
          "Until EO data exist, the app pre-fills the current rotation from the farm profile (F001 last_crop = barley, "
          "summer fallow) and the validation row for vegetated area is reported as *pending*, not passed."]
    (REPORTS / "04_evidence.md").write_text("\n".join(ev), encoding="utf-8")
