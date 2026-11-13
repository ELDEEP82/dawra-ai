# Dawra AI — دورة · 7 slides (NASA Space Apps Cairo 2026 · Field Shift · Team TerraNex)

---

## 1 · Challenge — Field Shift

- Help farmers **adapt what they plant** to a changing climate with NASA data.
- Pilot: **Ras Sudr, South Sinai** — the DRC desert research station and ~120 cultivated fields around it.
- The farmer's question: *"What should I grow for the next 3 years — and will it still work if it gets hotter, my
  well gets saltier, or I can't leach enough?"*
- Live: **dawra-ai.vercel.app** (English / عربي, Farmer mode, 30-s demo)

---

## 2 · Problem

- Crops need **1,912 mm** of water a year (NASA POWER + FAO-56); rain gives **47 mm → 2.4 %** of the need.
- Wells at **8.35 dS/m**; the aquifer's "highly saline" area rose **52 % → 83 %** (1996 → 2022, S16).
- Landsat: green area **~50 ha (1996) → ~1,200–1,600 ha (2022)** — more farms share the same salty water.
- Typical rotation **barley → bare summer**: the well (60 m³/day) waters only **2.4 of 5 feddan**.

---

## 3 · Solution — from space to the field

- **Compares** the farmer's current rotation with 3 optimised 3-year plans + a pick for *their* priorities.
- **Optimises crop and irrigated area** per season under the well's m³/day — profit in **EGP**, water in **m³**,
  soil health.
- **Stress-tests** each plan on **5,400 futures** (NASA climate 1981–2025, +1/+2 °C, drier, CMIP6 2050s, saltier
  well × 100/70/40 % leaching).
- **Explains** every plan in English and Egyptian Arabic: why · NASA evidence · benefits · gaps · risks.
- **Farmer mode**: 3 big questions → 1 plan in plain Arabic.

---

## 4 · NASA data (9 sources, via NASA POWER API + Google Earth Engine)

| NASA POWER 1981–2026 | Landsat 1990–2026 | Sentinel-2 (122 fields) | SMAP L4 | GPM IMERG V07 |
|---|---|---|---|---|
| ET0, rain, heat, stress | green-area time-lapse vs S16 | NDVI phenology, rotation guess | soil moisture | rain & extremes |

| MODIS LST/ET | SRTM | GRACE-FO | NEX-GDDP-CMIP6 |
|---|---|---|---|
| heat layer (ET: no data, documented) | slope, land mask | regional water trend | 5-model 2050s futures |

Local evidence: DRC barley trial (S1), soil/quinoa trial (S4), 39 wells (S17), aquifer change (S16), FAO-56/29/33,
2025–26 Egyptian prices.

---

## 5 · How it works

1. **Climate**: POWER → FAO-56 Penman–Monteith (FAO Example 18 ✔; POWER vs team file Δ = 0.0).
2. **Water & salt**: crop Kc curves, FAO-29 leaching, well m³/day cap; leaching achieved 100/70/40 %.
3. **Yield**: Maas–Hoffman + heat days, calibrated to S1 barley (4,215 kg/ha); wheat holdout −15 % (S6).
4. **Soil digital twin**: ECe (calibrated to S4), organic carbon, nitrogen, crop families — season by season.
5. **AI**: NSGA-II over crop + area for 6 seasons (≈20,000 plans/config) → Pareto front → TOPSIS for priorities.
6. **Static build** → Next.js on Vercel (4.8 MB of JSON, < 2 s per interaction, EN/AR, mobile).

---

## 6 · Results for farm F001 (5 feddan · 8.35 dS/m · 60 m³/day)

| Plan | Profit, 3 yrs | Water, 3 yrs | Soil | Robust |
|---|---|---|---|---|
| Current: barley / fallow ×3 | 125k EGP | 15,260 m³ | 52 | 32 % |
| **Best balance: wheat → fallow → wheat → fallow → triticale → fallow** | **158k (+26 %)** | **13,588 (−11 %)** | 55 | 49 % |
| Highest profit: wheat → cotton ×3 | 361k (+188 %) | 34,863 (+128 %) | 60 | 66 % |
| Soil builder: faba → cotton → squash → sesbania ×… | 131k (+5 %) | 28,168 (+85 %) | 71 | 56 % |
| Water saver: small-area wheat | 110k (−12 %) | 8,572 (−44 %) | 48 | 8 % |

- **26 % more profit with 11 % less water.** The current rotation fails as soon as leaching drops to 70 %.
- Validation: 15 pass · 9 fail (explained) · 4 calibrated · 1 not testable.

---

## 7 · Impact & next steps

- **Impact**: a Ras Sudr farmer sees in 30 seconds, in Arabic, how to earn more per m³ and keep salt out — and the
  extension officer sees the evidence, the gaps and the risks.
- **Honest by design**: every number traces to NASA data, a cited source or one of 139 documented assumptions;
  failures stay in the validation report.
- **Next**: measured leaching and well ECw from DRC; sourced prices for all crops; per-field soil tests; field trials
  of the balanced plan; SMS/WhatsApp summaries; more farms and wells across Sinai.
