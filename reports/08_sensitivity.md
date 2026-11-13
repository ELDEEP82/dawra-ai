# 08 — Sensitivity (±20 % on each assumption)

106 numeric assumptions from `data/assumptions.csv` were varied by −20 % and +20 %, one at a time (212 engine rebuilds incl. calibration). Candidate plans = the baseline NSGA-II front for F001 (ECw 8.35, 60 m³/day) + the current rotation; picks recomputed each time (balanced weights, risk weight set to 0 because robustness is not re-run per perturbation). Run-control values (population, seeds, bootstrap size, stress-only thresholds) are excluded.

![tornado](figures/08_tornado.png)

**Assumptions that change at least one pick: 11 of 106.**

| id | base_value | picks_changed | comp_value_-20% | comp_value_+20% | comp_water_-20% | comp_water_+20% |
|---|---|---|---|---|---|---|
| opt.min_cropped_slots | 3 | compromise, min_water | +0.0 | -33.2 | +0.0 | +77.5 |
| ws.ea_drip | 0.9 | compromise, min_water | -44.1 | +4.9 | -31.8 | +0.0 |
| econ.hi_wheat | 0.4 | best_soil, min_water | +35.9 | -23.9 | +0.0 | +0.0 |
| ymax.wheat | 5000 | best_soil, max_profit, min_water | -25.6 | +25.6 | +0.0 | +0.0 |
| ymax.squash | 20000 | best_soil, compromise, max_profit, min_water | +0.0 | -13.1 | +0.0 | +11.4 |
| ws.frac_mid | 0.4 | min_water | +11.3 | -8.3 | +4.1 | -1.7 |
| soil.lf_cal | 0.15 | min_water | +1.7 | -5.4 | +0.0 | +0.0 |
| heat.tcrit.cotton | 38 | best_soil, max_profit | +0.0 | +0.0 | +0.0 | +0.0 |
| heat.tcrit.legume | 36 | best_soil | +0.0 | +0.0 | +0.0 | +0.0 |
| opt.guard_productivity | 0.8 | best_soil, min_water | +0.0 | +0.0 | +0.0 | +0.0 |
| econ.hi_barley | 0.505 | best_soil, min_water | +0.0 | +0.0 | +0.0 | +0.0 |

## Top 15 by swing

| id | base_value | comp_value_-20% | comp_value_+20% | comp_water_-20% | comp_water_+20% | picks_changed |
|---|---|---|---|---|---|---|
| opt.min_cropped_slots | 3 | +0.0 | -33.2 | +0.0 | +77.5 | compromise, min_water |
| ws.ea_drip | 0.9 | -44.1 | +4.9 | -31.8 | +0.0 | compromise, min_water |
| econ.hi_wheat | 0.4 | +35.9 | -23.9 | +0.0 | +0.0 | best_soil, min_water |
| ymax.wheat | 5000 | -25.6 | +25.6 | +0.0 | +0.0 | best_soil, max_profit, min_water |
| econ.straw_price | 9500 | -17.2 | +17.2 | +0.0 | +0.0 |  |
| ymax.squash | 20000 | +0.0 | -13.1 | +0.0 | +11.4 | best_soil, compromise, max_profit, min_water |
| ws.frac_mid | 0.4 | +11.3 | -8.3 | +4.1 | -1.7 | min_water |
| ymax.triticale | 5000 | -10.1 | +10.1 | +0.0 | +0.0 |  |
| heat.tcrit.winter_cereal | 32 | -7.3 | +0.3 | +0.0 | +0.0 |  |
| ws.frac_dev | 0.25 | +6.6 | -4.7 | +4.0 | -2.6 |  |
| soil.lf_cal | 0.15 | +1.7 | -5.4 | +0.0 | +0.0 | min_water |
| clim.albedo | 0.23 | -3.9 | +4.2 | +0.4 | -0.5 |  |
| ws.frac_ini | 0.15 | +3.2 | -3.7 | +2.9 | -3.3 |  |
| ws.peak_window_days | 10 | -3.0 | +2.1 | -2.8 | +1.9 |  |
| sow.wheat | 14 | +1.7 | -1.2 | +0.1 | -0.0 |  |

Reading: the assumptions at the top of the tornado are the ones to verify locally first; flips are also shown on each plan card in the app.

Full table: `data/processed/sensitivity.csv`.