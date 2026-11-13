# 04 — Evidence engine (NDVI phenology, M5)

**Status: PENDING (needs EO data)**

Implemented in `engine/dawra/evidence.py` and unit-tested on synthetic NDVI series (`tests/test_eo_evidence.py`):

1. `phenology` — 16-day max composite → Savitzky–Golay (5, 2) → start/peak/end/amplitude/integral per season.
2. `classify_season` — transparent rules (bare / winter_crop / summer_crop / perennial), then a KMeans consistency check (`kmeans_agreement`). No ground truth is invented.
3. `bare_calendar` — share of years each season is bare.
4. `vulnerable_seasons` — bottom-quartile NDVI peak AND worst-quartile heat / LST / SMAP anomaly.
5. `current_rotation_guess` — most common W/S labels over the last 3 years (pre-fills the app; farmer confirms).
6. `transition_evidence` — mean next-season NDVI peak after each previous label (exploratory caveat).
7. `vegetated_area_check` — EO area with NDVI > 0.1 vs **1,579 ha in 2022 (S16)**, pass if within ±25 %.

Until EO data exist, the app pre-fills the current rotation from the farm profile (F001 last_crop = barley, summer fallow) and the validation row for vegetated area is reported as *pending*, not passed.