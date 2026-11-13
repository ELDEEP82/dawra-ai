# Validation — Dawra AI (F001, Ras Sudr)

Every check, its acceptance criterion and the result. Failures are kept and explained; *calibrated* rows are fits, not validations; *pending* rows need Earth Engine.

**Summary:** ✅ pass 11 · ❌ fail 4 · ⏳ pending 3 · 🔧 calibrated 2

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
| Yield | Wheat holdout — S6 read per feddan | 5,000 kg/ha | 5,905 kg/ha | ±20 % | ✅ pass | error -15.3 % |
| Yield | Wheat holdout — S6 read per hectare | 5,000 kg/ha | 2,480 kg/ha | ±20 % | ❌ fail | error +101.6 % — S6 does not state the area unit; per-feddan reading is the one in the data sheet. Needs confirmation from DRC. |
| Yield | Salinity_Yield sheet reproduced (Maas–Hoffman) | sorghum 8 %, cotton 74 %, wheat 53 %… | sheet values | exact (rounded) | ✅ pass | unit test test_salinity_sheet_reproduced |
| Soil | ECe/ECw at LF 0.15 vs S4 | 8.56 dS/m | 8.56 dS/m (S4) | fitted (k) | 🔧 calibrated | k = 0.703 |
| Soil | Season-mean ECe under the S1 trial (ECw 8.35, 400 mm) | 8.25 dS/m | 8.56 dS/m (S4, nearby station) | ±15 % | ✅ pass | independent of the k fit (different water, ECw, season) |
| Water | FAO-29 gross requirement vs S1 applied | 693 mm | 400 mm | ±25 % | ❌ fail | +73 %: the trial leached less than FAO-29 recommends (LF ≈ 0.16 vs LR 0.26) and furrow losses are counted. Dawra plans are conservative on water. |
| Earth obs. | ET0 vs MODIS MOD16 ET | — | MOD16A2GF | pattern r > 0.6 | ⏳ pending | needs Earth Engine |
| Earth obs. | Vegetated area (NDVI > 0.1) 2022 | — | 1,579 ha (S16) | ±25 % | ⏳ pending | needs Earth Engine |
| Earth obs. | CMIP6 scenario family in stress test | — | SSP2-4.5 / SSP5-8.5 | included | ⏳ pending | needs Earth Engine |
| App | Precomputed configurations | 75 files | 5 profiles × 5 ECw × 3 water = 75 | = 75 | ✅ pass |  |
| App | Largest plan file (one interaction) | 158 KB (≈ 23 KB gzip) | < 2 s per interaction | < 300 KB raw | ✅ pass | sliders read an in-memory grid (no network) |

## Software

- Engine tests: 63 passed, 0 failed (pytest, 8 test files)
- Web build: npm run build: compiled successfully, 0 type/lint errors, 3 static routes
- Secrets: none committed (`.env` ignored; `.env.example` only holds a placeholder).

## Sensitivity

±20 % one-at-a-time on 99 assumptions: **19** change at least one pick (see `reports/08_sensitivity.md`). Most influential: `opt.min_cropped_slots`, `ws.kc_mid.quinoa`, `ws.ea_drip`, `soil.lf_cal`, `ws.frac_mid`.

## Known limits

- Prices are blank → ranking by output index, not money (`data/prices_egp.csv`).
- Stress robustness is high (≥ 95 %) for all plans: with the leaching water applied, the model pays for heat and salt in water per feddan rather than yield. If farmers cannot apply the leaching fraction the risk is larger — cards say so explicitly (FAO-29 yield without leaching).
- Summer-fallow salt rise (+5 %/season) and residue/N parameters are literature-based assumptions.
- One farm (F001) and station-level data; field-level NDVI history pending Earth Engine.