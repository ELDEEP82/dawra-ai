# Validation — Dawra AI (F001, Ras Sudr)

Every check, its acceptance criterion and the result. Failures are kept and explained; *calibrated* rows are fits, not validations; *pending* rows need Earth Engine.

**Summary:** ✅ pass 15 · ❌ fail 9 · 🔧 calibrated 4 · ➖ not testable 1

| area | check | modelled | target / observed | criterion | result | note |
|---|---|---|---|---|---|---|
| Climate | NASA POWER API vs team CSV (2020–21 overlap) | max |Δ| = 0.000 | 0 | max |Δ| < 0.01 | ✅ pass |  |
| Climate | FAO-56 PM vs FAO-56 Example 18 (Brussels) | 3.9 mm/d (unit test) | 3.9 mm/d | ±0.1 mm/d | ✅ pass |  |
| Climate | Annual ET0 2020–2025 | 1,882–1,972 mm | 1,880–1,970 mm (CLAUDE.md) | every year in range | ❌ fail | 2024–25 slightly above the band (hot years) |
| Climate | Mean annual ET0 1981–2025 | 1,912 mm | ≈1,900 mm | ±5 % | ✅ pass |  |
| Climate | Annual rain 2020–2025 | 27–97 mm | 27–97 mm (CLAUDE.md) | every year in range | ✅ pass |  |
| Climate | Nov–Apr Tmax vs S1 Table 1 | max |Δ| 0.6 °C | S1 1983–2020 | ≤ 1.5 °C | ✅ pass |  |
| Climate | Nov–Apr Tmin vs S1 Table 1 | mean Δ +1.8 °C | S1 1983–2020 | ≤ 1.5 °C | ❌ fail | POWER nights warmer: the 0.5° MERRA-2 cell includes the Gulf of Suez (sea moderates Tmin). Affects only ET0's longwave term; frost is not a risk here. |
| Climate | Nov–Apr rain total vs S1 | 36.7 mm | 40.8 mm | ±25 % | ✅ pass |  |
| Yield | Barley grain at ECw 8.35, S1 seasons & water | 4,215 kg/ha | 4,215 kg/ha (S1) | fitted (1 parameter: ymax) | 🔧 calibrated | ymax = 4,268; modelled RY 98.8 % |
| Yield | Wheat holdout (S6, 16.5 ardeb per feddan) | 5,000 kg/ha | 5,905 kg/ha | ±20 % | ✅ pass | error -15.3 %. Unit resolved: Vetogate 2026-04-30 on the same KSIU trial — '16.5 أردبًا للفدان، بما يعادل نحو 2.48 طن' (https://www.vetogate.com/5646058). |
| Yield | Salinity_Yield sheet reproduced (Maas–Hoffman) | sorghum 8 %, cotton 74 %, wheat 53 %… | sheet values | exact (rounded) | ✅ pass | unit test test_salinity_sheet_reproduced |
| Soil | ECe/ECw at LF 0.15 vs S4 | 8.56 dS/m | 8.56 dS/m (S4) | fitted (k) | 🔧 calibrated | k = 0.703 |
| Soil | Season-mean ECe under the S1 trial (ECw 8.35, 400 mm) | 8.25 dS/m | 8.56 dS/m (S4, nearby station) | ±15 % | ✅ pass | independent of the k fit (different water, ECw, season) |
| Water | FAO-29 gross requirement vs S1 applied | 693 mm | 400 mm | ±25 % | ❌ fail | +73 %: the trial leached less than FAO-29 recommends (LF ≈ 0.16 vs LR 0.26) and furrow losses are counted. Dawra plans are conservative on water. |
| Earth obs. | ET0 vs MODIS MOD16 ET | 0 valid of 1196 images | MOD16A2GF | pattern r > 0.6 | ➖ not testable | MOD16A2GF returns no ET for any image over the 122 field polygons or the station: MOD16 skips pixels its MCD12Q1 land-cover map classes as barren/urban, which covers this desert plain at 500 m. ET0 cannot be cross-checked with MOD16 here. |
| Earth obs. | Vegetated area 1996, Landsat P90 NDVI > 0.1 | 6,028 ha | 57 ha (S16) | ±25 % | ❌ fail | S16's own threshold; with surface-reflectance NDVI the bare desert at the station reads ≈0.09 (median of 677 Sentinel-2 scenes), so most of the plain passes 0.1. |
| Earth obs. | Vegetated area 2022, Landsat P90 NDVI > 0.1 | 17,828 ha | 1,579 ha (S16) | ±25 % | ❌ fail | S16's own threshold; with surface-reflectance NDVI the bare desert at the station reads ≈0.09 (median of 677 Sentinel-2 scenes), so most of the plain passes 0.1. |
| Earth obs. | Vegetated area 1996, Landsat P90 NDVI > 0.15 | 234 ha | 57 ha (S16) | ±25 % | ❌ fail |  |
| Earth obs. | Vegetated area 2022, Landsat P90 NDVI > 0.15 | 4,024 ha | 1,579 ha (S16) | ±25 % | ❌ fail |  |
| Earth obs. | Vegetated area 1996, Landsat P90 NDVI > 0.2 | 106 ha | 57 ha (S16) | ±25 % | ❌ fail | operational threshold used for the map layer |
| Earth obs. | Vegetated area 2022, Landsat P90 NDVI > 0.2 | 2,153 ha | 1,579 ha (S16) | ±25 % | ❌ fail | operational threshold used for the map layer |
| Earth obs. | Vegetated area 1996, Landsat P90 NDVI > 0.25 | 51 ha | 57 ha (S16) | ±25 % | 🔧 calibrated | threshold chosen because it matches S16 in both years — a 1-parameter fit, so reported as calibrated; surface-reflectance NDVI reads higher over bare desert than S16's NDVI |
| Earth obs. | Vegetated area 2022, Landsat P90 NDVI > 0.25 | 1,208 ha | 1,579 ha (S16) | ±25 % | 🔧 calibrated | threshold chosen because it matches S16 in both years — a 1-parameter fit, so reported as calibrated; surface-reflectance NDVI reads higher over bare desert than S16's NDVI |
| Earth obs. | CMIP6 scenario families in stress test | cmip_ssp245, cmip_ssp585 | SSP2-4.5 / SSP5-8.5 | included | ✅ pass | 5-model ensemble monthly deltas (Tmax, rain) applied to the 1981–2025 record |
| Earth obs. | NDVI season labels: rules vs KMeans | 87 % agree | 122 fields, 2318 field-seasons | ≥ 70 % | ✅ pass | consistency check, not ground truth |
| Earth obs. | IMERG vs NASA POWER annual rain (2001–2025) | 28 mm | 48 mm (POWER) | ±50 % | ✅ pass | two independent NASA rain products at the station pixel |
| App | Precomputed configurations | 15 files | 5 ECw × 3 water (5 profiles inside) | = 15 | ✅ pass |  |
| App | Total web data | 4.3 MB | < 15 MB | < 15 MB | ✅ pass |  |
| App | Largest plan file (one interaction) | 318 KB (≈ 53 KB gzip) | < 2 s per interaction | < 900 KB raw | ✅ pass | sliders read an in-memory grid (no network) |

## Software

- Engine tests: 66 passed (pytest)
- Web build: npm run build: see P4
- Secrets: none committed (`.env` ignored; `.env.example` only holds a placeholder).

## Sensitivity

±20 % one-at-a-time on 106 assumptions: **11** change at least one pick (see `reports/08_sensitivity.md`). Most influential: `opt.min_cropped_slots`, `ws.ea_drip`, `econ.hi_wheat`, `ymax.wheat`, `econ.straw_price`.

## Known limits

- Prices are blank → ranking by output index, not money (`data/prices_egp.csv`).
- Stress robustness is high (≥ 95 %) for all plans: with the leaching water applied, the model pays for heat and salt in water per feddan rather than yield. If farmers cannot apply the leaching fraction the risk is larger — cards say so explicitly (FAO-29 yield without leaching).
- Summer-fallow salt rise (+5 %/season) and residue/N parameters are literature-based assumptions.
- One farm (F001) and station-level data; field-level NDVI history pending Earth Engine.