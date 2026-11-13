# Dawra AI — project context (read this first, every session)

NASA Space Apps Cairo 2026 · Challenge: **Field Shift: Adapting Farms with NASA Data** · Team TerraNex.
Pilot site: **Ras Sudr, South Sinai, Egypt** (DRC station 29.5997 N, 32.7014 E). Hyper-arid, saline wells.

## What we are building
A decision-support web app that, for one farm, compares **the farmer's CURRENT rotation** with **3 proposed
3-year (6-season) rotations** (max profit · min water · best soil) plus a farmer-weighted compromise, and
stress-tests every plan against bad climate years and futures. Every plan gets a 5-field explanation card:
**why suggested · evidence (NASA data) · benefits · information gaps · risks needing local expert review.**
The tool supports, never replaces, farmer judgment. All UI text English + Arabic.

## Hard rules
- Python 3.11. Every number in the model must trace to a source (file+sheet, paper id S1–S18, FAO-56, FAO-29)
  or be listed in `data/assumptions.csv` with a short justification. Never invent data silently.
- Don't hard-code results. Everything recomputes from `data/`.
- Units: mm, dS/m, kg/ha, EGP/feddan, m³. 1 feddan = 0.42 ha.
- Seasons: winter = Nov–Apr, summer = May–Oct. A plan = 6 slots: W1 S1 W2 S2 W3 S3.
- Keep modules independent and unit-tested (`pytest`). Small functions, type hints, docstrings.

## Data already in the repo (`data/raw/`) — verified by the team
1. `TerraNex_NASA_POWER.csv` — NASA POWER daily, 2020-01-01 → 2026-09-30, lat 29.5907 lon 32.7203, elev 215 m.
   Header text lines; the column row `YEAR,DOY,...` is line 17 → `pd.read_csv(path, skiprows=16)`. -999 = missing.
   Columns: ALLSKY_SFC_SW_DWN (MJ/m²/d), T2M_MIN, T2M_MAX, TS (°C), RH2M (%), WS2M (m/s), GWETROOT (0–1), PRECTOTCORR (mm/d).
   Sanity values: FAO-56 PM ET0 ≈ 1,880–1,970 mm/yr; rain 27–97 mm/yr.
2. `ras_sudr_local_data_1.xlsx` (read with `header=None`, then slice):
   - `Crops`: TRANSPOSED. Column index 3 = attribute names (crop_id, crop_en, local_name_egypt, family, use,
     season_ras_sudr, sowing_window, total_days, Kc_ini, Kc_mid, Kc_end, root_depth_m, p_depletion, ECe_100,
     ECe_90, ECe_75, ECe_50, ECe_0, ECw_100…ECw_0, salt_rating, N_fixing, soil_role, local_evidence,
     stage_days_source); columns 4+ = one crop each (21 crops: barley, wheat, triticale, barley_forage, sorghum,
     pearl_millet, sudan_grass, bermuda, rhodes, sugar_beet, quinoa, cotton, alfalfa, cowpea, faba_bean,
     sesbania, tomato, squash, watermelon, date_palm, olive). Drop empty columns. root_depth like "1.0–1.5" → mean.
     Blank salt thresholds are intentional (use salt_rating fallback: T/MT/MS/S → typical FAO-29 thresholds, list in assumptions).
   - `Soil_Baseline`: header row index 3 (parameter, value, unit, basis). Key: sand 86.95 %, clay 4.3 %, SOC 0.18 %,
     pH 8.15, ECe 8.56, ECw 8.35, N 26.2 / P 5.2 / K 51.5 mg/kg, θFC 0.16, θWP 0.06, TAW 100 mm/m, REW 6 mm, LF 0.15.
   - `Salinity_Yield`: Maas–Hoffman calculator; table header row index 7.
   - `Local_Yields`: header row index 3. Calibration: barley grain 4,215 kg/ha at ECw 8.35, 400 mm furrow/season (S1).
     Holdout: wheat ≈ 2.48 t at ~5,000 ppm well water (S6).
   - `Farmer_Priorities`: weights header row index 3 (criteria: profit, water_saving, salt_tolerance, soil_health,
     market_demand, risk_climate; profiles: balanced, profit_first, water_saving, soil_building, this_farmer);
     farm profile header row index 23, example row 24 (F001: 5 feddan, ECw 8.35, 60 m³/day, drip, 20 livestock,
     last_crop barley, preferred "barley; sorghum", avoid "tomato", budget medium, family labour, local feed market).
   - `Groundwater`: 39 wells by zone (header row 4), zone summary (row 47), 2022 stats (row 57),
     salinity-class area 1996 vs 2022 (row 66): "highly saline" share 52 % → 83 %.
   - `SoilGrids_Grid`: regional grid; weak in desert (sand 43 % vs measured 87 %) → relative use only.
   - `Site`, `Soil_Water_Measured`, `Sources` (S1–S18 with URLs).
3. Prices are NOT in the data. `data/prices_egp.csv` must be created with columns
   crop_id, price_egp_per_ton, cost_egp_per_feddan, source, is_assumption — placeholders flagged is_assumption=1.

## Architecture (package `dawra/`)
- `data_io.py` M1 loaders + harmonization (field × month × season)
- `climate.py` POWER fetch/extend to 1981, FAO-56 PM ET0, effective rain, heat-day counts
- `water_salt.py` M2 Kc curves, ETc, leaching requirement LR = ECw/(5·ECe_t − ECw), gross irrigation
- `yield_model.py` M3 Maas–Hoffman Yr = 100 − b(ECe − a), b = 50/(ECe50 − ECe100), heat factor, calibration
- `soil_twin.py` M4 seasonal state: ECe, SOC, N, last families
- `eo.py` + `evidence.py` M5 Earth Engine extraction + NDVI phenology, bare/vulnerable seasons
- `optimizer.py` M6 NSGA-II (pymoo), TOPSIS pick, current-rotation baseline
- `stress.py` M7 scenarios + robustness; `explain.py` 5-field cards (templates; LLM only for wording)
- `app/` Streamlit app; `tests/`; `reports/`
