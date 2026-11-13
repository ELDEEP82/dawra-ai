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

## P7 — Validation & submission
- **D36 Validation table** (`reports/validation.md`, copy `07_validation.md`): 11 pass · 4 fail · 3 pending · 2
  calibrated. Fails are kept: ET0 2024 is 1.5 mm above the 1,970 mm sanity band; POWER Tmin is +1.8 °C vs S1 (coastal
  0.5° cell); wheat holdout fails under the per-hectare reading of S6; the FAO-29 water requirement is +73 % vs the 400 mm
  the S1 trial applied (trial leached less). Pending rows need Earth Engine.
- **D37 Sensitivity** uses a fixed candidate set (baseline Pareto front + current) re-simulated under each ±20 %
  perturbation with a full engine rebuild (calibration included) — 198 rebuilds instead of 198 NSGA-II runs. 19 of 99
  assumptions change at least one pick; the most influential are stage-length fractions, drip Ea, quinoa Kc, the S4 ECe
  calibration LF and the "≥ 3 cropped seasons" rule.
- **D38 Submission**: `submission/slides.md` (exactly 7 slides) and `submission/video_script.md` (~75 words, mapped to
  the in-app Demo mode).

## Upgrade round — P2 Prices
- **D39 Prices** researched (data/external/prices_research.csv, SOURCES_prices.md, accessed 2026-11-13). Fully sourced
  price + cost: wheat (procurement 2,500 EGP/ardeb, Ahram Apr-2026; cost 25,000 EGP/fdn, Masrawy May-2026) and tomato.
  Sourced prices also for sugar beet, cotton (Beni Suef auction), faba bean, squash/watermelon (Obour wholesale), dates,
  olive (FAOSTAT × CBE rate). All other prices/costs are flagged estimates with the method stated. Cards list estimated
  crops under "information gaps".
- **D40 Pumping** 0.68 EGP/m³ (diesel 20.50 EGP/L, Nebraska pumping-plant standard, 30 m total head — head assumed).
- **D41 Straw** revenue for barley/wheat/triticale at 9,500 EGP/t (Egypt Telegraph, May 2026); barley HI 0.505 from S1
  grain/biological yield, wheat HI 0.40 (assumption). Without straw barley would look loss-making, which contradicts
  local practice (straw feeds the farm's 20 head).
- **D42 S6 resolved**: 16.5 ardeb is **per feddan** (Vetogate 2026-04-30 quote) → wheat holdout −15 % (pass).

## Upgrade round — P1 Earth observation (real data)
- **D43 Earth Engine live** (project in git-ignored `.env`, loaded with python-dotenv). All downloads cached in `data/eo/`
  with `data/eo/SOURCES.md` (dataset ids, licences, date 2026-11-13). Extractors are resumable (skip cached outputs).
- **D44 Fields** = Sentinel-2 2025 NDVI amplitude (P90−P10) > 0.15 and P90 > 0.25, vectorised locally (computePixels →
  contourpy + shapely; server-side reduceToVectors timed out), ≥ 0.5 ha, simplified 8 m → 122 fields, 125 ha, 61 KB.
- **D45 Vegetated area vs S16.** S16's "NDVI > 0.1" does not transfer to surface-reflectance NDVI: bare desert at the
  station reads ≈ 0.09 (median of 677 S2 scenes), so 0.1 flags most of the plain. Sea glint also inflated Landsat-8 P90
  over the Gulf of Suez → land mask (SRTM > 0). Thresholds 0.1/0.15/0.2/0.25 are all reported; 0.25 matches S16 in 1996
  (51 vs 57 ha) and 2022 (1,208 vs 1,579 ha) and is used for the chart — reported as *calibrated*, not validated.
- **D46 SMAP** station cell is coastal/masked → mean of land cells within 15 km. **MOD16 ET** returns no data for any of
  1,196 images over the fields or the station (MOD16 skips MCD12Q1 barren/urban pixels) → ET0 cross-check reported as
  *not testable*. **ECOSTRESS** is not in the Earth Engine public catalog → documented; MODIS LST used instead.
- **D47 Evidence on real NDVI**: per-field monthly S2 NDVI → phenology, rule labels (KMeans agreement 87 %), rotation
  guess, bare calendar, transitions. 67 of 122 fields are perennial (orchards / palms), 10 follow winter crop + summer
  fallow (like F001).
- **D48 CMIP6** (NEX-GDDP, 5 models: ACCESS-CM2, MPI-ESM1-2-HR, MRI-ESM2-0, EC-Earth3, GFDL-ESM4): ensemble monthly
  ΔTmax and Δpr (2041–2060 vs 1995–2014) applied to the 1981–2025 record as two extra stress families.

## Upgrade round — P3 Stronger, more honest results
- **D49 Leaching achieved** is a stress dimension: 100 / 70 / 40 % of the FAO-29 leaching water (S1 itself applied
  ≈ 60 %). Robustness is pooled over 9 climate families (incl. 2 CMIP6) × 3 leaching levels × 200 draws = 5,400 futures.
  It now separates plans: current barley/fallow 32 % (salt builds up as soon as leaching drops), balanced 49 %,
  wheat/cotton 66 %; the minimum-water plan scores 8 % because most of the farm is left idle and salty.
- **D50 Crop + area genes**: 12 genes (6 crops + 6 irrigated-area levels 10…100 % of the farm, capped by the well).
  Reported: idle feddan, EGP per m³, kg per m³. The current rotation keeps "as much as the well allows".
- **D51 Compromise guard**: TOPSIS considers only plans keeping ≥ 80 % of the current profit (same guard as the water and
  soil picks); without it TOPSIS chose barley on 10 % of the farm.
- **D52 Uncertainty bands** P10/P50/P90 of profit, output and final ECe from the historical bootstrap (full leaching);
  they are narrow because year-to-year climate varies little here — management (leaching) is the bigger risk.
- **D53 Export v2**: one file per (ECw × water) with a de-duplicated plan library, picks, per-profile compromise cards,
  Pareto front, optimiser search sample, ECe paths for the stress animation, 7×4×4×3 what-if grid → 4.3 MB total.
- **D54 Sensitivity** re-run on the new model (106 assumptions): 11 change a pick; flips are shown on each card.

## Upgrade round — P4 World-class web / P5 Verify
- **D55 Stack**: Next.js 14 static + framer-motion (MotionConfig reducedMotion="user") + plain three.js globe (NASA Blue
  Marble texture, public domain) + react-leaflet with Esri imagery and Earth Engine PNG overlays (NDVI per year, MODIS
  LST, IMERG rain, SRTM slope) + the 122 Sentinel-2 fields coloured by their NDVI rotation pattern.
- **D56 Performance**: below-the-fold sections mount on approach (`LazySection`), charts/map/what-if are dynamic
  imports, plan/map/evidence JSON load after first paint, WebGL globe only on ≥ 640 px screens after 0.9 s (static Blue
  Marble image otherwise). First-load JS 318 KB → 161 KB. Lighthouse (local prod build): home desktop 99/100/100/100,
  home mobile 90/100/100/100, Farmer mode mobile 86/100/100/100.
- **D57 Hydration**: initial render identical on server and client (no reduced-motion branches in initial state) →
  zero console errors in Playwright across desktop/mobile × EN/AR.
- **D58 Farmer mode** (/farmer): 3 big questions (well salinity, water per day, money/water/soil) → the TOPSIS plan for
  profit_first / water_saving / soil_building, plain-Arabic numbers per year and the top 3 risks.

## Light redesign (visual only — engine results unchanged)
- **D59 Light design system**: canvas #FAFAF7, white surfaces, 1 px #E8E8E3 borders, layered soft shadows, 22 px radii;
  brand #0F6B4F, leaf #2BB673, sky #2D8CFF, sand #E8A23A, risk #E5533D, ink #14201B, muted #5E6B66 (AA on white).
  Legacy Tailwind names were remapped in `tailwind.config.ts` (`white`→ink, `slate`→AA greys, `space`→paper,
  `nasa`→brand) so every component switched theme consistently. Plan colours = dataviz light reference palette
  (validated; three slots < 3:1 contrast, so plans are always labelled by name).
- **D60 Header**: the Demo button is gone everywhere; demo runs only via `?demo=1` (`?lang=ar&demo=1`). One language
  button ("English" on Arabic pages, "عربي" on English pages) cross-fades, flips direction, saves to localStorage
  (try/catch) and updates `?lang=`.
- **D61 Flip cards**: plan cards (front = plan, timeline, EGP, m³, soil, ring + P10–P90; back = 5-field card with NASA
  dataset chips) and NASA dataset cards flip with spring physics, hover tilt + glare, Enter/Space, mirrored in RTL,
  fade under reduced motion. Hero stat cards use a CSS-only flip so the first load stays free of framer-motion.
- **D62 Map**: CARTO tiles now return "API key required", so the light basemap is Esri World Light Gray (no key);
  satellite imagery is a toggle.
- **D63 Performance**: above-the-fold animations are CSS (word reveal, fades, scroll cue, progress bar); plan cards,
  charts, map and what-if mount on approach. Home first-load JS 167 → 117 KB. Lighthouse (local prod): home 93 mobile /
  98 desktop, farmer 88 / 100, NASA data 89 / 100; accessibility 100 / 100 / 96.

## First-load reliability + app layout (UI only — engine results unchanged)
- **D64 Language on the server**: the refresh problem came from choosing the language *after* hydration (English SSR,
  then localStorage/`?lang` flipped to Arabic), so first-time visitors saw an English flash, a layout jump and
  hydration mismatches. Now `middleware.ts` resolves `?lang=` → `lang` cookie → Accept-Language and rewrites to the
  prerendered `/en` or `/ar` route (`app/[lang]`, static), so `<html lang dir>` is right on the first byte. The toggle
  only sets the cookie and reloads the other prerendered page; localStorage is no longer used.
- **D65 Above-the-fold values in HTML**: `app/[lang]/page.tsx` (server) reads `public/data/{climate,meta,evidence}.json`
  at build time and passes the hero numbers (rain 2.4 % of ET0, ECw 8.35 dS/m, 1,579 ha green in 2022, S16) to the
  client app; counters no longer start at 0.
- **D66 Globe never blank**: a 480/960 px WebP poster (rendered from the Blue Marble texture by
  `scripts/make_poster.py`, Ras Sudr marker) plus a 1 KB inline 32 px preview are in the HTML; the WebGL globe mounts on
  the visitor's first interaction (≥640 px, motion allowed, WebGL available) and cross-fades in only after its first
  textured frame (~0.75 s locally). If that takes >2 s it is dropped and the poster stays.
- **D67 App structure**: compact hero (fits 1280×720) + sticky segmented tabs (① Your farm ② Plans ③ What-if
  ④ Satellite evidence ⑤ NASA data) with ARIA tabs, arrow keys, URL hash + back button, a direction-aware slide, and a
  mobile bottom tab bar. Bento grid (max 1200 px, 12 columns, 24 px gaps), one card header style (lucide icon, ≤5-word
  title, one-line explanation), error boundary with Retry per card, content-shaped skeletons. Plans tab: summary strip
  computed from the plan JSON (+26 % profit · −11 % water · robustness 49 % vs 32 % today for F001) and a
  "Recommended for you" badge on the farmer-weighted compromise.
- **D68 Loading**: the core JSON (meta, climate, evidence, map, default plan file) is prefetched on
  `requestIdleCallback` after first paint; tab code (charts, map, motion) and the neighbouring well/water plan files are
  warmed on the first interaction, and Next link prefetch is off for Farmer mode / NASA data — executing those during
  load added ~0.8 s of blocking time on mobile. Lazy mounts use an 800 px root margin. Fonts trimmed to the two weights
  used (400/600). Cache headers: `/data/*` 1 h + stale-while-revalidate 1 day; `/textures/*` 1 year immutable.
- **D69 Map stacking**: Leaflet controls use z-index 1000; the map container is now `isolation: isolate` so they can no
  longer paint over the sticky header or the mobile bottom tab bar (found by the screenshot run).
