# Earth-observation downloads — sources, dates, licences

All files in this folder were produced by `engine/dawra/eo.py` through Google Earth Engine (project set in the
git-ignored `.env`), accessed **2026-11-13**. Each product is the public dataset below; no data were edited by hand.

| File | Dataset (Earth Engine id) | Provider / licence | Resolution · period | URL |
|---|---|---|---|---|
| `ndvi_station.csv` | Landsat 5/7/8/9 C2 L2 (`LANDSAT/LT05,LE07,LC08,LC09/C02/T1_L2`) + Sentinel-2 SR harmonized (`COPERNICUS/S2_SR_HARMONIZED`) | USGS/NASA Landsat — public domain; Copernicus Sentinel data — free & open (Copernicus licence) | 30 m / 10 m · 1990–2026 / 2017–2026 | https://developers.google.com/earth-engine/datasets/catalog/landsat · https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED |
| `vegetated_area.csv` | Landsat C2 L2 annual P90 NDVI > 0.1 over the AOI | public domain | 30 m · 1990–2025 | as above |
| `fields_2025.geojson`, `field_ndvi_monthly.csv` | Sentinel-2 SR harmonized (NDVI amplitude P90−P10 > 0.15 and P90 > 0.25; monthly max) | Copernicus licence | 10 m · 2017–2026 | as above |
| `field_terrain.csv`, `srtm_aoi.csv`, `overlays/slope.png` | SRTM 1 arc-second (`USGS/SRTMGL1_003`) | NASA/USGS — public domain | 30 m · 2000 | https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003 |
| `smap_station.csv` | SMAP L4 Global 3-hourly 9 km (`NASA/SMAP/SPL4SMGP/008`), monthly means | NASA NSIDC DAAC — public | 9 km · 2015–2026 | https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL4SMGP_008 |
| `imerg_station.csv` | GPM IMERG Final V07 half-hourly (`NASA/GPM_L3/IMERG_V07`), daily sums | NASA GES DISC — public | 0.1° · 2001–2025 | https://developers.google.com/earth-engine/datasets/catalog/NASA_GPM_L3_IMERG_V07 |
| `overlays/rain_annual.png` | GPM IMERG monthly V07 (`NASA/GPM_L3/IMERG_MONTHLY_V07`) | NASA GES DISC — public | 0.1° · 2001–2025 | https://developers.google.com/earth-engine/datasets/catalog/NASA_GPM_L3_IMERG_MONTHLY_V07 |
| `modis_station.csv`, `overlays/lst_summer.png` | MODIS Terra LST 8-day (`MODIS/061/MOD11A2`) and ET 8-day gap-filled (`MODIS/061/MOD16A2GF`) | NASA LP DAAC — public | 1 km / 500 m · 2000–2026 | https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD16A2GF |
| `grace_station.csv` | GRACE/GRACE-FO mascon (first available of `NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI`, …) | NASA JPL / CSR — public | ~0.5° grid (~300 km effective) · 2002–present | https://developers.google.com/earth-engine/datasets/catalog/NASA_GRACE_MASS_GRIDS_V04_MASCON_CRI |
| `cmip6_deltas.csv` | NASA Earth Exchange GDDP-CMIP6 (`NASA/GDDP-CMIP6`), 5 models × SSP2-4.5/SSP5-8.5 | NASA NEX — CC BY 4.0 (per model terms) | 0.25° · 1995–2014 vs 2041–2060 | https://developers.google.com/earth-engine/datasets/catalog/NASA_GDDP-CMIP6 |
| `overlays/ndvi_<year>.png` | Landsat annual P90 NDVI thumbnails (masked < 0.1) | public domain | 30 m resampled · 1990–2025 | as Landsat |

**ECOSTRESS**: not in the Earth Engine public catalog (checked `projects/earthengine-public/assets/NASA` on
2026-11-13: no ECOSTRESS collection). MODIS MOD11A2 (LST) and MOD16A2GF (ET) are used instead.

NASA data are freely available; NASA does not endorse Dawra AI.
