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
