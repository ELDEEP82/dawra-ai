# 05 — Optimiser (M6, NSGA-II)

Farm F001 at ECw 8.35 dS/m, 60 m³/day; population 120 × 200 generations, seed 42. Feasible Pareto plans: **120**; unique plans evaluated: 10,447.

**Prices pending** — `data/prices_egp.csv` is blank, so the profit objective is the *relative productivity index* = Σ seasons (planted share of the farm × relative yield). It ranks plans by how much of the farm's potential output they deliver; it is not money.

![pareto](figures/05_pareto.png)

## Current rotation vs the four picks (balanced profile for the compromise)

| plan | W1 | S1 | W2 | S2 | W3 | S3 | value | water_m3 | soil_index | min_RY_% | market |
|---|---|---|---|---|---|---|---|---|---|---|---|
| current | barley | fallow | barley | fallow | barley | fallow | 1.45 | 15259.75 | 52.23 | 99.93 | 1.00 |
| max_profit | barley | sorghum | quinoa | sorghum | quinoa | sorghum | 2.01 | 31256.19 | 60.83 | 99.90 | 0.67 |
| min_water | squash | fallow | squash | fallow | barley_forage | fallow | 1.16 | 11137.99 | 58.77 | 90.17 | 0.33 |
| best_soil | faba_bean | sorghum | faba_bean | sorghum | faba_bean | cowpea | 1.21 | 32409.23 | 71.85 | 72.63 | 0.50 |
| compromise | barley | fallow | barley_forage | fallow | barley_forage | fallow | 1.39 | 13654.69 | 55.37 | 95.48 | 1.00 |

Picks: *max_profit* = highest value on the front; *min_water* and *best_soil* = lowest water / highest soil index among plans keeping ≥ 80 % of the current rotation's value (`opt.guard_productivity`); *compromise* = TOPSIS with the profile weights (Farmer_Priorities). Climate-risk weight uses robustness from M7 in the final build.
