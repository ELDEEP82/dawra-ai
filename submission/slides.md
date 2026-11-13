# Dawra AI — 7 slides (NASA Space Apps Cairo 2026 · Field Shift · Team TerraNex)

---

## 1 · The challenge — Field Shift

- Help farmers **adapt what they plant** to a changing climate, using NASA data.
- Our pilot: **Ras Sudr, South Sinai** — the DRC desert research station and the farms around it.
- One question a farmer can act on: *"What should I grow in the next 3 years — and will it still work if it gets hotter
  or my well gets saltier?"*

---

## 2 · The problem

- Crops here need **≈1,900 mm** of water a year (NASA POWER, FAO-56); it rains **≈47 mm**.
- Wells are salty (**6–9 dS/m**, some > 20); the aquifer's "highly saline" area rose **52 % → 83 %** (1996 → 2022, S16).
- The usual rotation — **barley in winter, bare land in summer** — leaves hot, salty soil half the time.
- A 60 m³/day well can water only **≈2.4 of 5 feddan** of barley at peak demand.

---

## 3 · The solution — Dawra AI (دورة)

- Compares the farmer's **current rotation** with **3 optimised 3-year plans** (highest output · water saver · soil
  builder) and **a balanced pick for the farmer's own priorities**.
- **Stress-tests** every plan on 45 years of NASA climate, +1/+2 °C, −10/−20 % rain and a saltier well.
- **Explains** every plan in English and Arabic: why · NASA evidence · benefits · information gaps · risks for the
  extension officer.
- Bilingual, mobile-friendly web app; decision support only.

---

## 4 · NASA data

- **NASA POWER** daily 1981–2026 (CERES radiation; MERRA-2 temperature, humidity, wind, rain, root-zone wetness) →
  FAO-56 Penman–Monteith ET0, effective rain, heat days, every stress scenario.
- **Earth Engine pipeline (code ready, login pending):** Sentinel-2 & Landsat NDVI (field history, bare seasons),
  SMAP L4, GPM IMERG V07, MODIS LST/ET, SRTM, GRACE-FO, NEX-GDDP-CMIP6.
- Local evidence: DRC barley trial (S1), quinoa/soil trial (S4), 39 wells (S17), aquifer change (S16), FAO-56/29/33.

---

## 5 · How it works

1. **Climate** — POWER → FAO-56 ET0 (verified on FAO Example 18; overlap with our file Δ = 0.0).
2. **Water & salt** — crop Kc curves, FAO-29 leaching; planted area limited by the well's m³/day.
3. **Yield** — Maas–Hoffman salt response + heat days; calibrated to S1 barley (4,215 kg/ha).
4. **Soil twin** — ECe (calibrated to S4), organic carbon, nitrogen, crop-family history.
5. **Optimiser** — NSGA-II over 6 seasons + TOPSIS; current rotation always simulated the same way.
6. **Stress test + cards** → 75 precomputed scenarios → static Next.js app on Vercel.

---

## 6 · Results for farm F001 (5 feddan · well 8.35 dS/m · 60 m³/day)

| Plan (3 years) | Water m³ | Output index | Soil score | Robust |
|---|---|---|---|---|
| Current: barley / fallow ×3 | 15,260 | 1.45 | 52 | 96 % |
| Highest output: barley → sorghum → quinoa → sorghum → quinoa → sorghum | 31,256 (+105 %) | 2.01 (+39 %) | 61 | 100 % |
| Water saver: squash → fallow → squash → fallow → forage barley → fallow | 11,138 (−27 %) | 1.16 (−20 %) | 59 | 100 % |
| Soil builder: faba bean → sorghum → faba bean → sorghum → faba bean → cowpea | 32,409 (+112 %) | 1.21 (−17 %) | 72 | 100 % |
| Balanced pick: barley → fallow → forage barley → fallow → forage barley → fallow | 13,655 (−10.5 %) | 1.39 (−4 %) | 55 | 100 % |

- Validated: ET0 1,912 mm/yr, POWER vs local record, wheat holdout −15 % (per-feddan reading). Prices pending → output index.

---

## 7 · Impact & next steps

- **Impact:** a farmer sees, in 30 seconds and in Arabic, how to save ~10–27 % water or build soil — with the risks
  spelled out for the extension officer.
- **Next:** Earth Engine login → field NDVI history, SMAP/IMERG, CMIP6 futures; local crop prices; field trials with
  DRC Ras Sudr; more farms and wells; SMS/WhatsApp summary for farmers.
- Open, reproducible: every number traces to NASA data, a cited source or a documented assumption.
