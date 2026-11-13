# DECISIONS.md — engineering & modelling decisions log

Each entry: what was decided, why, and where it lives. Model numbers are in `data/assumptions.csv`.

## P0 — Setup
- **D01 Python 3.11 via `uv`.** The machine had Python 3.12/3.13 only; CLAUDE.md requires 3.11, so `uv venv --python 3.11 .venv`
  (repo root). All engine commands use `.venv`.
- **D02 Layout.** The engine package lives in `engine/dawra/` (target architecture of the build brief) rather than repo-root
  `dawra/`; tests in `engine/tests/`. The Streamlit `app/` of CLAUDE.md is replaced by the Next.js `web/` app (brief: must
  deploy on Vercel, no Python at runtime). The engine exports static JSON to `web/public/data/`.
- **D03 `make` is not installed on this Windows machine.** A `Makefile` is provided for Linux/macOS/CI and an equivalent
  `tasks.py` (`python tasks.py test|data|build|web|all`).
- **D04 Crops sheet layout.** CLAUDE.md says the sheet is transposed; the delivered workbook is row-per-crop with the header
  at row index 3. `load_crops()` detects both layouts, so either version of the file works.
- **D05 Single source for tunable numbers.** Every model parameter is read by id from `data/assumptions.csv` through
  `dawra.assumptions.get()`. This makes the ±20 % sensitivity run a loop over ids and keeps every number traceable.
- **D06 Prices.** `data/prices_egp.csv` has one row per crop with blank price/cost and `is_assumption=1`. Nothing is invented.
  When any needed price is blank the engine switches to a *relative productivity index* (see P3) and flags `prices_pending`.

## P1 — Climate
- **D07 POWER extension.** 1981-01-01→2019-12-31 from the POWER daily point API (community AG, same pixel as our file);
  2020+ from the team CSV. 2020–2021 overlap: max abs difference 0.0 for all 8 variables. Cached as
  `data/processed/power_1981_2026.parquet` and committed so the build runs offline.
- **D08 Solar gap 1981–1983.** POWER has no CERES radiation for 1981–83. Hargreaves (FAO-56 Eq.50, kRs 0.16) is −24 %
  vs CERES here (coastal site), so it is bias-corrected per calendar month with the CERES/Hargreaves ratio from all
  overlapping days; filled days carry `rs_filled = 1`.
- **D09 ET0.** Full FAO-56 PM with ea from daily mean RH (Eq.19), G = 0, Rso = (0.75+2e-5 z)Ra. Unit-tested against
  FAO-56 Example 18 (3.9 mm/d) and Example 8 (Ra). Warming scenarios shift Tmax/Tmin and hold RH constant.
- **D10 Effective rain.** USDA-SCS monthly formula (FAO CROPWAT), applied to monthly totals and distributed back to days.

## P2 — Agronomy (M2–M4)
- **D11 Crop parameters.** Crops sheet first; gaps filled only from `assumptions.csv` rows (Kc for bermuda/rhodes/quinoa/
  sesbania, root depths, sowing offsets, ymax). Stage splits are parsed from `stage_days_source` when it lists four numbers
  (e.g. sorghum 20/35/45/30), else FAO-56 default fractions.
- **D12 Salt thresholds without FAO-29 numbers** (triticale, pearl millet, rhodes, quinoa, sesbania, watermelon, olive) use
  the *median* ECe_100/ECe_50 of the Crops-sheet crops with the same salt_rating — computed from the data, not typed in.
  Quinoa → T (S4 trial at ECw 7.94), pearl millet → MT (conservative); both flagged as assumptions.
- **D13 ECe model consistent with the leaching formula.** The brief's LR = ECw/(5·ECe_t − ECw) implies
  ECe/ECw = (1+LF)/(5·LF) (1.53 at LF 0.15, matching FAO-29's ≈1.5). Soil ECe relaxes toward k·ECw·(1+LF)/(5LF) with
  k = 0.703 calibrated so LF 0.15 reproduces S4 (ECe 8.56 at ECw 7.94). Approach rate = drainage / (θFC·root depth).
  Yield uses the season-mean ECe of that exponential path. LF is the *achieved* LF (drainage / applied), so drip losses
  count as leaching.
- **D14 Water-limited planted area.** F001's 60 m³/day cannot irrigate 5 feddan at peak demand (barley ≈ 2.4 fdn,
  summer crops ≈ 1 fdn). Each season the planted area = min(farm area, well m³/day ÷ crop peak 10-day gross demand); the
  rest is fallow. Soil state is the area-weighted farm average. This is the honest reading of the farm data.
- **D15 Calibration.** Barley ymax fitted so the model reproduces S1 4,215 kg/ha using the trial's own ~400 mm furrow
  water and its seasons (2018/19–2019/20) → ymax 4,268 kg/ha. Barley forage fitted to S1 15,456 kg/ha fresh forage →
  16,923 (S1 best genotype: 16,977). Other ymax are FAO-33 midpoints or flagged assumptions.
- **D16 Wheat holdout.** S6 ("16.5 ardeb ≈ 2.48 t", area unit not stated) is reported under both readings: per feddan
  −15 % (pass ±20 %), per hectare +102 % (fail). Not hidden; explained in reports.

## P3 — Optimiser (M6)
- **D17 Encoding.** 6 integer genes; gene domain = crops sown in that slot type (W/S, from `season_ras_sudr` and the
  sowing window for "winter or spring" / perennials) minus avoided crops, plus fallow. A perennial chosen in slot i
  automatically occupies slot i+1 (decode); a perennial in S3 is a constraint violation. Date palm / olive are excluded
  (border options).
- **D18 Constraints** (pymoo inequality ≤ 0): wrong slot, broken perennial, sowing overlap > 7 days (cyclic: S3 → next W1),
  > 2 consecutive seasons of one family (fallow breaks a run), min relative yield ≥ 50 %, ≥ 3 cropped seasons.
  Peak water ≤ well capacity holds by construction (D14).
- **D19 Prices pending → relative productivity index** = Σ seasons (planted share × relative yield × revenue weight; green
  manure weight 0). JSON carries `prices_pending: true` and `value_kind: "productivity_index"`. When all prices are filled
  the same code returns net profit in EGP.
- **D20 Picks.** max_profit = max value; min_water / best_soil = best among plans keeping ≥ 80 % of the current rotation's
  value (no plan should make the farmer much poorer); compromise = TOPSIS over 6 criteria with the profile weights
  (risk_climate = robustness from M7). The current rotation is always simulated with the same `simulate()`.
- **D21 Speed.** Assumptions are cached in a dict, prices pre-mapped and plan evaluations memoised: ~1.8 ms per plan,
  ~27 s per NSGA-II run (120 × 200).

## P4 — Stress test & explanation (M7)
- **D22 Bootstrap blocks = agricultural years** (W(y) + the following S(y+1)); three blocks drawn with replacement give
  200 distinct 3-year sequences (a fixed 3-year moving block would give only 42). Start years 1981–2024 with complete data.
- **D23 Well cap in scenarios.** Planted area is fixed beforehand from the typical climate. In a scenario the peak gross
  demand (hotter → higher ETc; saltier → higher LR) may exceed the well's m³/day; during the peak period
  (`st.peak_share` = 50 % of seasonal water) only Q/(area·peak) is delivered. The shortfall removes leaching water first
  (ECe rises), then crop water (FAO-33 Ky = 1, `yield.ky`). In the typical climate this changes nothing (r = 1).
- **D24 Robustness** = pooled share over 7 scenario families × 200 draws (Prompt 6 definition). CMIP6 deltas are wired
  as an extra family and reported `"cmip6": "pending"` until Earth Engine runs.
- **D25 Finding, not hidden:** robustness is ≥ 95 % for all F001 plans. With FAO-29 leaching applied, yield per feddan
  stays near potential; heat and salinity are paid in water per feddan (fewer irrigable feddan), which the optimiser
  counts. Rain changes barely matter (rain ≈ 2.5 % of ET0). The current rotation is the least robust (salt build-up
  after summer fallow).
- **D26 Cards** are template-built from the plan JSON (EN + Egyptian-friendly Arabic, Western digits). `llm_polish` is
  an optional hook that raises if any number changes.

## P5 — Earth observation & evidence (M5)
- **D27 Earth Engine not authenticated on this machine** (no GEE_PROJECT, no credentials). Per the brief the full code is
  written (`eo.py`: NDVI S2+Landsat, vegetated area, field polygons, SMAP L4, IMERG V07, MODIS LST/ET, SRTM, GRACE mascons,
  GDDP-CMIP6 deltas) with mocked tests; `extract_all()` returns `status: pending` instead of failing, and every EO output
  in the web JSON is marked `pending`.
- **D28 Interim soil-moisture context** = NASA POWER MERRA-2 GWETROOT (already in our series), shown in the app and cards.
- **D29 Evidence engine** (`evidence.py`) runs on any NDVI DataFrame and is tested on synthetic barley/fallow and
  double-crop series; rules first, KMeans only as a consistency check; vegetated-area validation vs S16 (1,579 ha) will
  report pass/fail once EO data exist — it is listed as *pending* in validation, not as passed.
- **D30 To finish EO:** `earthengine authenticate` → set `GEE_PROJECT` → `make data` (or `python tasks.py data`) →
  `make build`. CMIP6 deltas then join the stress test as an extra scenario family.

## P6 — Web app
- **D31 Static architecture.** `engine/build.py` precomputes 75 configuration files (5 profiles × 5 ECw × 3 water) plus
  meta/climate/evidence/map JSON; the Next.js 14 App Router app only fetches them (memoised + neighbour prefetch). No
  Python at runtime; deploys to Vercel from `web/` (`web/vercel.json`). Vercel's Root Directory cannot be set from a
  root `vercel.json`, so the README documents `cd web && npx vercel --prod` or Root Directory = `web`.
- **D32 Bilingual + RTL.** `LangProvider` switches `<html lang dir>`; `?lang=ar` deep-links Arabic. Arabic text uses
  Western digits throughout (as on Egyptian price boards). Charts stay LTR inside RTL pages; mixed text uses `<bdi>`.
- **D33 Charts.** Plan colours = the dataviz reference categorical palette (dark steps), validated on the app surface
  (#0a1024): all checks pass. No dual-axis charts (rain and ET0 share mm). Animations off for instant interaction.
- **D34 Map.** Esri World Imagery with attribution; markers as circle markers (no icon assets); AOI rectangle; field
  polygons appear automatically when `data/eo/fields_*.geojson` exists.
- **D35 Demo mode.** 7 steps × 4.3 s ≈ 30 s: map → NASA snapshot → farm F001 → plans → explanation → what-if (+2 °C,
  −20 % rain, +2 dS/m) → disclaimer.
