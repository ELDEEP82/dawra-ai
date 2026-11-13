# Dawra AI — دورة (NASA Space Apps Cairo 2026 · Field Shift · Team TerraNex)

**Live demo:** https://dawra-ai.vercel.app · **Code:** https://github.com/ELDEEP82/dawra-ai

## Summary

Dawra AI ("dawra" = rotation in Arabic) helps farmers in Ras Sudr, South Sinai — one of the driest and saltiest farming
areas in Egypt — choose a 3-year crop rotation that earns more per cubic metre of well water, keeps salt out of the root
zone and still works in hot years, with saltier wells or when they cannot apply enough leaching water. For a real farm
profile (5 feddan, well water at 8.35 dS/m, 60 m³/day) it compares the farmer's current barley-and-fallow rotation with
plans found by a multi-objective optimiser, stress-tests every plan on 5,400 simulated futures and explains each one in
English and Egyptian Arabic: why it was suggested, the NASA evidence, the benefits, the information gaps and the risks
the local extension officer should check. The balanced plan for this farm earns **26 % more with 11 % less water**;
the current rotation turns out to be the most fragile, failing as soon as leaching drops to 70 % of the requirement.

## How we used NASA data

- **NASA POWER** (CERES radiation, MERRA-2 weather, 1981–2026, daily): FAO-56 Penman–Monteith reference ET
  (≈ 1,912 mm/yr vs ≈ 47 mm of rain), effective rain, heat days, root-zone wetness, and the 45-year climate record
  re-sampled for the stress test.
- **Landsat 5/7/8/9** (1990–2025): yearly green area of the plain (time-lapse on the map), checked against a published
  survey (57 ha in 1996, 1,579 ha in 2022).
- **Sentinel-2** (with ESA): 122 cultivated field polygons and their monthly NDVI → season labels, bare seasons and
  the most likely current rotation per field.
- **SMAP L4** soil moisture, **GPM IMERG V07** rain and extreme days, **MODIS** land-surface temperature, **SRTM**
  slope, **GRACE/GRACE-FO** regional water storage — evidence in every plan card and layers on the map.
- **NEX-GDDP-CMIP6** (5 models, SSP2-4.5 and SSP5-8.5, 2041–2060): monthly temperature and rain changes applied to the
  historical record as two future stress scenarios.

## Tools

Python 3.11 (pandas, numpy, pymoo NSGA-II, scikit-learn, Google Earth Engine API, shapely), NASA POWER API, Google
Earth Engine, FAO-56 / FAO-29 / FAO-33 methods; Next.js 14, TypeScript, Tailwind, framer-motion, three.js, Recharts,
react-leaflet with Esri imagery; Playwright for visual QA; Vercel hosting. Every number traces to NASA data, a cited
local source (S1–S18), a sourced 2025–26 Egyptian price, or one of 139 documented assumptions; the validation report
keeps the failures.

## Team

Team **TerraNex** — NASA Space Apps Cairo 2026.
