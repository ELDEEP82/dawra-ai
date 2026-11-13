# Prices, costs and pumping (2025–2026, EGP)

Every row has a basis and a URL in `data/external/prices_research.csv` (sources listed in `data/external/SOURCES_prices.md`, accessed 2026-11-13). Fully sourced rows (price and cost): **2 of 21**; rows with a sourced price: **20**. Estimates are flagged `is_assumption = 1` in `data/prices_egp.csv` and on the plan cards.

| crop_id | product | price_egp_per_ton | cost_egp_per_feddan | status | price_basis | cost_basis |
|---|---|---|---|---|---|---|
| barley | grain | 12300 | 20000 | ⚠ estimate (see basis) | ESTIMATE: FAOSTAT Egypt 2023 barley/maize producer-price ratio (12,475/14,400 EGP = 0.866) x local yellow maize 14,200 EGP/t (Al-Mal 2026-09-11) | ESTIMATE: 0.8 x wheat itemised cost 25,000 EGP/fed (Masrawy 2026-05-14); barley needs less N and fewer irrigations |
| wheat | grain | 16667 | 25000 | ✅ sourced | Official procurement 2026 season: 2,500 EGP/ardeb (grade 23.5) / 0.150 t | Itemised 2025/26 cost (seed, 3 ploughings, N/P/K fertiliser, irrigation+weeding+labour, harvest/threshing) ~25,000 EGP/fed, academic quoted by Masrawy 2026-05-14 |
| triticale | grain | 12300 | 25000 | ⚠ estimate (see basis) | ESTIMATE: no Egyptian market; valued as feed grain = barley estimate (12,300 EGP/t) | ESTIMATE: same input package as wheat (25,000 EGP/fed, Masrawy 2026-05-14) |
| barley_forage | fresh green forage | 1500 | 15000 | ⚠ estimate (see basis) | ESTIMATE: wheat-straw 9,500 EGP/t (midpoint 9,000-10,000, Egypt Telegraph 2026-05-02) / 0.9 DM x 0.20 DM x ~0.7 perishability discount | ESTIMATE: barley cost 20,000 minus harvest/threshing (~3,000-5,000 per wheat itemisation) |
| sorghum | grain | 12800 | 18000 | ⚠ estimate (see basis) | ESTIMATE: 0.9 x local yellow maize 14,200 EGP/t (Al-Mal 2026-09-11) | ESTIMATE: ~0.7 x wheat cost 25,000 EGP/fed; fewer inputs, summer crop |
| pearl_millet | grain | 12800 | 15000 | ⚠ estimate (see basis) | ESTIMATE: no Egyptian market; set equal to sorghum estimate | ESTIMATE: ~0.6 x wheat cost; low-input summer cereal |
| sudan_grass | hay | 9500 | 15000 | ⚠ estimate (see basis) | ESTIMATE: anchored to wheat straw 9,000-10,000 EGP/t midpoint (Egypt Telegraph 2026-05-02) as floor for grass hay | ESTIMATE: ~0.6 x wheat cost per season (seed, N, irrigation, 2-3 cuts, baling) |
| bermuda | hay | 9500 | 20000 | ⚠ estimate (see basis) | ESTIMATE: anchored to wheat straw 9,000-10,000 EGP/t midpoint (Egypt Telegraph 2026-05-02) | ESTIMATE: per year for established perennial stand (N fertiliser, multiple cuts, baling); ~0.8 x wheat cost |
| rhodes | hay | 9500 | 20000 | ⚠ estimate (see basis) | ESTIMATE: anchored to wheat straw 9,000-10,000 EGP/t midpoint (Egypt Telegraph 2026-05-02) | ESTIMATE: per year, perennial; same as bermuda |
| sugar_beet | roots | 2000 | 35000 | ⚠ estimate (see basis) | Official cabinet procurement price 2025/26 season: 2,000 EGP/t | ESTIMATE: 1.4 x wheat cost 25,000 EGP/fed (longer ~7-month season, more fertiliser, harvest and transport) |
| quinoa | seed | 37000 | 20000 | ⚠ estimate (see basis) | ESTIMATE: no Egyptian market price; set equal to faba bean farm price ~37,100 EGP/t (niche food grain) | ESTIMATE: 0.8 x wheat cost |
| cotton | seed cotton | 60063 | 45000 | ⚠ estimate (see basis) | Beni Suef auction 2026-10-21: 9,420-9,500 EGP/kantar seed cotton (Giza 95); midpoint 9,460 / 0.1575 t | ESTIMATE: 1.8 x wheat cost 25,000 EGP/fed (long season, hand-picking labour) |
| alfalfa | hay | 12500 | 35000 | ⚠ estimate (see basis) | ESTIMATE: ~1.3 x wheat straw midpoint 9,500 EGP/t (Egypt Telegraph 2026-05-02) | ESTIMATE: per year; ~1.4 x wheat cost (P/K fertiliser, 8-10 cuts, baling) |
| cowpea | dry grain | 37100 | 18000 | ⚠ estimate (see basis) | ESTIMATE: set equal to faba bean farm price (5,750 EGP/ardeb of 155 kg) as dry-pulse proxy | ESTIMATE: ~0.7 x wheat cost; legume, low N |
| faba_bean | dry grain | 37097 | 20000 | ⚠ estimate (see basis) | ARC legume research dept. head (Masrawy 2026-10-28): 5,500-6,000 EGP/ardeb of 155 kg; midpoint 5,750 / 0.155 t | ESTIMATE: 0.8 x wheat cost 25,000 EGP/fed (no N fertiliser) |
| sesbania | green manure | 0 | 8000 | ⚠ estimate (see basis) | No sale price (green manure incorporated into soil) | ESTIMATE: seed + tillage + irrigation + incorporation; no harvest cost |
| tomato | fresh | 14000 | 100000 | ✅ sourced | Farm-gate (in-field) 14 EGP/kg quoted by Farmers Syndicate head, Al-Mal 2026-11-05 | Average cost per feddan this season 100,000 EGP (tomato/potato), same source |
| squash | fresh | 10000 | 60000 | ⚠ estimate (see basis) | Obour wholesale 2026-11-06: 6-14 EGP/kg, midpoint 10 EGP/kg (wholesale, not farm-gate) | ESTIMATE: ~0.6 x tomato cost 100,000 EGP/fed (Al-Mal 2026-11-05); shorter season |
| watermelon | fresh | 10000 | 70000 | ⚠ estimate (see basis) | Obour wholesale 2026-11-06: 80-100 EGP per 8-10 kg fruit = ~10 EGP/kg | ESTIMATE: ~0.7 x tomato cost 100,000 EGP/fed |
| date_palm | fruit | 14317 | 40000 | ⚠ estimate (see basis) | FAOSTAT Egypt 2023 producer price USD 256.3/t x 55.86 EGP/USD (CBE sell rate 2026-11-01 as reported by Al-Mal https://almalnews.com/2144681/) | ESTIMATE: annual cost per feddan of bearing palms (irrigation, fertiliser, pollination, harvest labour) |
| olive | fruit | 55782 | 35000 | ⚠ estimate (see basis) | FAOSTAT Egypt 2023 producer price USD 998.6/t x 55.86 EGP/USD (CBE sell rate 2026-11-01 as reported by Al-Mal https://almalnews.com/2144681/) | ESTIMATE: annual cost per feddan of bearing grove (irrigation, fertiliser, pruning, hand harvest) |

## By-product: cereal straw

Barley, wheat and triticale also earn straw (tibn) at 9,500 EGP/t (Egypt Telegraph, May 2026). Straw = grain × (1 − HI)/HI with HI 0.505 for barley (S1 grain 4,215 / biological 8,348 kg/ha) and 0.40 for wheat/triticale (assumption).

## Groundwater pumping

| item | value | unit | notes |
|---|---|---|---|
| diesel_price | 20.5 | EGP/L | Pricing committee held fuel prices on 2026-10-15; diesel 20.50 EGP/L (in force since 2026-03-10 per https://al-ain.com/article/fuel-prices-egypt-today-saturday-july-18-2026). |
| electricity_tariff_irrigation | 2.5 | EGP/kWh | Irrigation tariff raised to 255 piastres/kWh from 128.3 (Amwal Al Ghad 2026-05-13). |
| hydraulic_energy_per_m3_per_m | 0.0 | kWh/(m3*m) | E = m*g*h = 1000 kg x 9.81 m/s2 x 1 m = 9,810 J = 0.002725 kWh (g and 1 kWh = 3.6 MJ from FAO Water lifting devices ch.2). |
| diesel_pumpset_output_standard | 2.5 | kWh hydraulic per L diesel | Nebraska Pumping Plant Performance Criteria 12.5 water-hp-h per US gal: 12.5 x 0.7457 kWh / 3.7854 L = 2.462 kWh/L. With diesel ~10 kWh/L (FAO ah810e04) this is ~25% overall fuel-to-water efficiency (a well-maintained plant). |
| diesel_use_per_m3_per_m | 0.0 | L/(m3*m) | 0.002725 / 2.462. |
| representative_total_dynamic_head | 30.0 | m | ASSUMPTION: static water level ~11 m (midpoint of observed 4.6-17.1 m) + ~9 m drawdown + ~10 m (1 bar) drip delivery pressure. is_assumption=1. |
| diesel_pumping_cost_30m | 0.7 | EGP/m3 | 0.001107 L/(m3*m) x 30 m = 0.0332 L/m3 x 20.50 EGP/L = 0.681 EGP/m3. At 17.1 m: 0.39; 50 m: 1.13; 65 m: 1.47 EGP/m3. Field pumps below the Nebraska standard can use 1.3-2x more fuel. Fuel only (excludes pump capital, maintenance, labour). |
| electric_wire_to_water_efficiency | 0.5 | fraction | FAO worked example for small electric centrifugal system: motor 85% x transmission 98% x pump 70% x pipes 80% = 47%. |
| electric_pumping_cost_30m | 0.4 | EGP/m3 | 0.002725/0.47 = 0.0058 kWh/(m3*m) x 30 m = 0.174 kWh/m3 x 2.55 EGP/kWh = 0.444 EGP/m3. At 17.1 m: 0.25; 50 m: 0.74; 65 m: 0.96 EGP/m3. Energy only. |

Model value: **0.68 EGP per m³** (diesel, 30 m total head; fuel only) charged on every m³ of irrigation. Perennial forage costs are annual and charged half per season.

Profit = Σ seasons [(product t × price + straw t × straw price − production cost) × planted feddan − pumping m³ × EGP/m³]. Production cost excludes land rent (owner-operated family farm, F001).