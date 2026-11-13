# PROGRESS.md — one status line per phase

- P0 Setup ✅ — git, .venv (Python 3.11 via uv), Makefile + tasks.py, assumptions.csv, blank prices_egp.csv, Next.js 14 scaffold in web/; 9 tests green.
- P1 Climate ✅ — POWER extended to 1981 (overlap diff 0.0), FAO-56 PM ET0 (Ex.18 ✔), mean ET0 1,912 mm/yr, rain 47 mm/yr; reports/01_climate.md; 17 tests green.
- P2 Agronomy ✅ — Kc/ETc/LR/gross irrigation, Maas–Hoffman + heat, soil twin (ECe/SOC/N/families); barley calibrated to S1 (ymax 4,268), ECe/ECw to S4 (k 0.703), wheat holdout −15 % (per-feddan reading); reports/03_agronomy.md; 40 tests green.
- P3 Optimiser ✅ — NSGA-II (120×200) + TOPSIS + current baseline; F001: max-output +38 % value / +105 % water, water-saver −27 % water, soil-builder index 71.8, balanced −10.5 % water at −4 % value; prices pending → productivity index; 46 tests green.
- P4 Stress + cards ✅ — 7 scenario families × 200 bootstrap draws, well-capacity-limited scenarios, 112-cell what-if grid (<5 s/plan), 5-field EN/AR cards; F001 robustness: current 96 %, others 100 %; CMIP6 pending (GEE); 54 tests green.
