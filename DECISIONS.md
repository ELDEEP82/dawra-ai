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
