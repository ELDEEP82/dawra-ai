# Dawra AI — build commands for VS Code (paste one at a time, in order)

How to use: open the `dawra` folder in VS Code, open your AI agent (Claude Code / Copilot Agent mode),
paste **Prompt 0**, wait until it finishes and tests pass, then Prompt 1, and so on.
After each prompt: run `pytest -q` and look at the report it produced before moving on.
Prompts 2 and 4 need a Google Earth Engine project (`earthengine authenticate` once).

---

## Prompt 0 — Project setup

```
Read CLAUDE.md fully. It is the source of truth for this project.
Set up the project:
1. Create the structure: dawra/ (package with __init__.py), app/, tests/, data/raw/ (already has our 2 files),
   data/processed/, data/eo/, reports/, notebooks/.
2. requirements.txt: pandas, numpy, openpyxl, requests, pymoo, scikit-learn, earthengine-api, streamlit,
   folium, streamlit-folium, plotly, pytest, python-dotenv. Create a venv and install.
3. data/assumptions.csv with columns: id, module, parameter, value, unit, justification, source.
   Start it empty except a header.
4. data/prices_egp.csv with columns crop_id, price_egp_per_ton, cost_egp_per_feddan, source, is_assumption,
   one row per crop_id from the Crops sheet, values blank, is_assumption=1. Do NOT invent prices.
5. A Makefile or tasks: `make test`, `make app`, `make report`.
6. README.md: one paragraph on what Dawra AI is, how to run it.
Stop when `pytest -q` runs (zero tests is fine) and show me the tree.
```

## Prompt 1 — Data layer + climate (M1, ET0)

```
Implement dawra/data_io.py and dawra/climate.py following CLAUDE.md.

data_io.py:
- load_power(path) -> daily DataFrame with a DatetimeIndex built from YEAR+DOY, -999 -> NaN.
- load_crops(xlsx) -> tidy DataFrame, one row per crop, typed columns (numbers as float, ranges "a–b" -> mean,
  N_fixing -> bool). The Crops sheet is transposed: attribute names in column index 3, crops in columns 4+.
- load_soil_baseline, load_local_yields, load_farmer_profiles (weights per profile, normalised to sum 1)
  and load_farm_profile (row 24 example), load_groundwater_zones. Use the exact header rows given in CLAUDE.md.
- season_of(date): 'W' Nov–Apr (season year = year of the November), 'S' May–Oct.
- monthly(df) and seasonal(df) aggregations.

climate.py:
- fetch_power(lat, lon, start, end) using the NASA POWER daily point API, community=AG, parameters
  ALLSKY_SFC_SW_DWN,T2M_MIN,T2M_MAX,TS,RH2M,WS2M,GWETROOT,PRECTOTCORR; cache to data/processed/power_1981_2026.parquet.
  Extend our series back to 1981-01-01 and verify the overlap with our CSV matches (max abs diff small) — print it.
- et0_fao56(df, lat, elev): full FAO-56 Penman–Monteith daily (Ra from latitude/DOY, Rso, Rnl with actual vapour
  pressure from RH2M, G=0). Unit-test against FAO-56 Example 18 (Brussels) within 0.1 mm/day.
- effective_rain_monthly(P): FAO/USDA-SCS style; document the formula in assumptions.csv.
- heat_days(df, threshold): count of days with T2M_MAX above threshold.

Then write reports/01_climate.md with: annual ET0 and rain 1981–2025, monthly climatology vs the S1 table in the
Site sheet (Tmin/Tmax/Precip Nov–Apr), the 5 hottest and 5 driest seasons (we need them for the stress test),
and one PNG chart. Expected: ET0 ≈ 1,900 mm/yr, rain < 100 mm/yr. Add tests in tests/test_climate.py.
```

## Prompt 2 — NASA Earth Engine extraction (M1/M5 inputs)

```
Implement dawra/eo.py with the Google Earth Engine Python API (ee.Initialize(project=os.environ['GEE_PROJECT'])).
AOI: Ras Sudr agricultural plain, bbox lon 32.65–32.80, lat 29.50–29.75. Also support a single field polygon.
Functions, each returning a pandas DataFrame and caching CSV under data/eo/:
1. ndvi_timeseries(geom, start, end): Sentinel-2 SR harmonized (2017+) and Landsat 5/7/8/9 C2 L2 (1990+),
   cloud-masked (SCL / QA_PIXEL), NDVI per scene, mean over geom, plus a 16-day composite series.
2. vegetated_area(year): area (ha) with annual max NDVI > 0.1 in the AOI — we validate against 1,579 ha in 2022.
3. field_candidates(year): vectorize pixels with seasonal NDVI amplitude > 0.15 into field polygons (min 0.5 ha),
   export as GeoJSON — these are the fields the app can show.
4. smap_rootzone(point): SMAP L4 (NASA/SMAP/SPL4SMGP latest version) surface + root-zone soil moisture, daily mean.
5. imerg_daily(point): GPM IMERG V07 daily precipitation, plus annual count of days > 10 mm and > 20 mm.
6. modis_lst_et(point): MOD11A2 day LST and MOD16A2GF ET (8-day), scaled to °C and mm.
7. srtm_slope(geom): mean/max slope and elevation from USGS/SRTMGL1_003.
8. grace_trend(point): GRACE/GRACE-FO mascon liquid water equivalent monthly + linear trend (cm/yr).
9. cmip6_deltas(point): NASA/GDDP-CMIP6, models ACCESS-CM2, MPI-ESM1-2-HR, MRI-ESM2-0 (or available),
   SSP2-4.5 and SSP5-8.5, 2041–2060 vs 1995–2014: monthly delta tas, tasmax (°C) and pr (%).
Batch requests to avoid limits; if GEE is unavailable, raise a clear error and keep cached CSVs working.
Write reports/02_eo.md: what was pulled, date ranges, pixel sizes, caveats (SMAP 9 km coastal mixing, GRACE coarse),
and 3 PNG charts (NDVI series for the DRC station field, IMERG annual, GRACE trend). Tests with mocked ee calls.
```

## Prompt 3 — Agronomy engine: water, salt, yield, soil twin (M2–M4)

```
Implement dawra/water_salt.py, dawra/yield_model.py, dawra/soil_twin.py following CLAUDE.md.

water_salt.py:
- kc_curve(crop, sow_date): FAO-56 4-stage linear Kc (stage fractions default 0.15/0.25/0.40/0.20 of total_days;
  record in assumptions.csv), returns daily Kc for the season.
- etc_season(crop, sow_date, climate_daily) -> daily ETc and season total (mm).
- leaching_requirement(ECw, ECe_threshold) = ECw / (5*ECe_t - ECw), capped [0, 0.5].
- gross_irrigation(etc, peff, LR, Ea) with Ea drip 0.90, sprinkler 0.75, furrow 0.60 -> mm and m³/feddan
  (1 mm on 1 feddan = 4.2 m³). Peak daily m³/day for the farm area, to check against water_m3_per_day.

yield_model.py:
- maas_hoffman(ECe, a=ECe_100, b=50/(ECe_50 - ECe_100)) -> relative yield %, clipped 0–100.
  For crops without thresholds use salt_rating fallback (document values in assumptions.csv).
- heat_factor(crop, climate, sow_date): penalty for days with Tmax above a crop-specific critical temperature during
  the mid stage (put the thresholds per crop family in assumptions.csv with sources).
- expected_yield(crop, ECe, climate, sow_date, ymax): ymax calibrated so barley at ECw 8.35 reproduces 4,215 kg/ha
  (S1). Run the wheat holdout check and report the error. Ymax for crops without local data: FAO/Egypt typical values
  in assumptions.csv marked as assumption.

soil_twin.py:
- SoilState dataclass: ECe, SOC_pct, N_mg_kg, families (last 2), season index.
- step(state, crop_or_fallow, ECw, LF_achieved, rain_mm) -> new state:
  ECe moves toward ECw*f(LF) (calibrate f so ECw 7.94 -> ECe 8.56 measured, S4); summer fallow raises ECe
  (capillary rise factor, assumption); SOC += residue_return*humification - decay*SOC; legumes add fixed N
  (cowpea, faba bean, alfalfa, sesbania — values from literature, assumption rows), others remove uptake;
  repeated family -> pest_risk flag.
- soil_health_index(state_start, state_end) in 0–100 combining ΔECe, ΔSOC, ΔN (weights in assumptions.csv).

Then reports/03_agronomy.md: simulate the farmer's current rotation (barley winter / fallow summer x3) for F001 and
show water, yield, ECe, SOC, N per season; calibration + holdout errors; table of all assumptions used.
Tests for each formula with hand-checked numbers.
```

## Prompt 4 — Evidence engine from NDVI (M5)

```
Implement dawra/evidence.py using the cached EO data from Prompt 2.
1. phenology(ndvi_series): smooth (Savitzky–Golay on the 16-day series), detect seasons: start, peak, end, amplitude,
   integral, per field per season.
2. classify_season(features): label each field-season as winter_crop, summer_crop, perennial, or bare.
   Use transparent rules first (timing of peak vs our season calendar, amplitude, persistence across 12 months);
   then KMeans on the features to check consistency; report agreement. No fake ground truth.
3. bare_calendar(field): which months/seasons are typically bare (share of years).
4. vulnerable_seasons(field): seasons where NDVI peak is in the bottom quartile AND heat days or LST anomaly or
   SMAP anomaly is in the worst quartile — return them with the evidence values.
5. current_rotation_guess(field): most common sequence of labels over the last 3 years, to pre-fill the app;
   the farmer confirms it.
6. transition_evidence(): across all fields, mean next-season NDVI peak after each previous label
   (e.g. after bare vs after a summer crop), with counts and a clear 'exploratory' caveat.
Validate: vegetated area vs 1,579 ha in 2022 (S16). reports/04_evidence.md with maps (PNG) and tables. Tests.
```

## Prompt 5 — Optimizer + baseline (M6)

```
Implement dawra/optimizer.py with pymoo NSGA-II.
- Decision: 6 integer genes (W1,S1,W2,S2,W3,S3); each gene = index into the crops allowed in that season
  (season_ras_sudr from Crops; perennials like alfalfa/bermuda/rhodes occupy consecutive slots; date_palm/olive
  excluded from the 3-year plan but listed as border options) plus 'fallow'.
- simulate_plan(plan, farm, climate_years) uses M2–M4 to return: net_profit_egp (needs prices_egp.csv; if prices
  missing use relative revenue index and show a warning), gross_water_m3, soil_health_index, min relative yield,
  feasible flags.
- Objectives: maximize profit, minimize water, maximize soil health. Constraints: peak water <= farm
  water_m3_per_day, relative yield >= 50 % for every crop at the farm ECw, no family 3 times in a row,
  avoid_crops excluded.
- run(farm, profile): pop 120, 200 generations, seed fixed. Return the Pareto set and pick:
  max_profit, min_water, best_soil, and a TOPSIS compromise using the farmer profile weights
  (map criteria: profit, water_saving, salt_tolerance=min rel. yield, soil_health, market_demand (from
  preferred_crops / use=forage when livestock>0), risk_climate (filled after M7)).
- ALWAYS evaluate the farmer's current rotation with the same simulate_plan and return it as 'current'.
Output JSON schema (save to data/processed/plans_F001.json) for the app:
{farm_id, plans:[{id, label, seasons:[{slot, crop_id, crop_en, crop_ar, sow_month, water_mm, water_m3,
 rel_yield_pct, yield_kg_ha, revenue, cost}], totals:{profit, water_m3, soil_index, ECe_end, SOC_end, N_end},
 soil_trajectory:[...], robustness:null, explanation:null}]}
reports/05_optimizer.md: Pareto scatter PNG, the 4 plans + current side by side. Tests.
```

## Prompt 6 — Climate stress test + explanation cards (M7)

```
Implement dawra/stress.py and dawra/explain.py.
stress.py:
- build_scenarios(): (a) historical: every winter+summer season 1981–2025 from the extended POWER series,
  block-bootstrap 3-year sequences (n=200, fixed seed); (b) deltas: +1 °C, +2 °C on Tmin/Tmax, rain -10 %, -20 %
  (recompute ET0); (c) CMIP6 monthly deltas from Prompt 2 for SSP2-4.5 and SSP5-8.5; (d) well salinity +1, +2 dS/m
  (justify with the Groundwater sheet trend 52 % -> 83 % highly saline).
- robustness(plan) = share of scenarios where every season keeps yield >= 70 % of its baseline expectation
  AND final ECe <= starting ECe. Also return the worst scenario and its cause. Fill plans_*.json robustness.
- scenario_slider(plan, dT, dRain, dECw) fast path for the app (< 1 s).
explain.py:
- card(plan, current, evidence) -> {why, evidence, benefits, gaps, risks} in English AND Arabic, built from
  numbers with templates (e.g. 'Uses 31 % less water than your current rotation (X vs Y m³)').
  Evidence must cite NASA datasets used (POWER, SMAP, IMERG, NDVI, ECOSTRESS/MODIS, SRTM, GRACE, CMIP6).
  Gaps list assumptions that matter for that plan (from assumptions.csv). Risks list items needing local expert
  review (seed availability, market, pests, salinity of THIS well).
- Optional: llm_polish(text) behind a flag; it may only rephrase, never change numbers (assert numbers unchanged).
reports/06_stress.md with robustness bars PNG. Tests.
```

## Prompt 7 — The app (world-class, bilingual)

```
Build app/streamlit_app.py — a polished, farmer-friendly Streamlit app (dark space theme, NASA-style but our own
brand 'Dawra AI'), language toggle EN / العربية (RTL layout when Arabic).
Pages / sections:
1. Pin & Go: folium map of Ras Sudr with the field candidates from Prompt 2 and the DRC station; click a field.
   Show its NASA snapshot: NDVI history chart with bare seasons shaded, heat days, rain, SMAP, slope, GRACE trend.
2. Your farm: inputs prefilled from F001 (area, well ECw, water m³/day, irrigation system, livestock,
   current rotation pre-filled from evidence.current_rotation_guess, preferred/avoid crops) + priority sliders
   (profit, water, salt tolerance, soil, market, climate risk) or a profile preset.
3. Plans: 'Your current rotation' + 3 plans + compromise as cards with a 6-season timeline (crop icons/colours),
   water m³, profit, soil index, robustness badge; a comparison table; soil trajectory chart (ECe, SOC, N).
4. Each plan card expands to the 5-field explanation (why, evidence, benefits, gaps, risks).
5. What-if sliders: temperature +0..+3 °C, rain -0..-30 %, well ECw +0..+3 dS/m -> live update of robustness/yields.
6. Glossary (ET, NDVI, ECe/ECw, leaching, soil-moisture anomaly, robustness) EN + AR.
7. Footer on every page: 'Decision support only — confirm with your local agricultural extension officer.'
Load from cached JSON/CSV so the demo works offline. Make it fast (<2 s per interaction) and mobile-friendly.
Then add a 'Demo' button that loads F001 and walks through the story for the 30-second video.
```

## Prompt 8 — Validation, sensitivity, submission pack

```
1. reports/07_validation.md: run every validation in the plan (climate vs S1, ET0 vs MODIS ET, barley calibration,
   wheat holdout, ECe vs measured, vegetated area vs S16) with pass/fail against the acceptance criteria, numbers,
   and charts. Do not hide failures; explain them.
2. Sensitivity: vary each assumption in assumptions.csv by ±20 % (one at a time), rerun F001, report which
   assumptions change the plan ranking (tornado chart PNG).
3. README.md: problem, solution, NASA data used (with links), architecture diagram (mermaid), how to run, limits.
4. submission/: 7-slide outline (challenge, problem, solution, NASA data, how it works, results for F001, impact &
   next steps) as slides.md, and a 30-second video script (~75 words) with shot list using app screens.
5. Final check: pytest all green, app runs from a clean venv, no secrets in the repo.
```
