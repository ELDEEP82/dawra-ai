# 06 — Stress test & explanation cards (M7)

Scenario families: historical block bootstrap (agricultural years W(y)+S(y+1), 1981–2025, 3 blocks drawn with replacement, n = 200, seed 7), +1/+2 °C (ET0 recomputed), −10/−20 % rain, well ECw +1/+2 dS/m (aquifer 'highly saline' share 52 % → 83 %, S16). CMIP6 deltas: **pending** (needs Earth Engine).

Pass = every cropped season ≥ 70 % of its typical-climate yield AND final ECe ≤ starting ECe. In each scenario the planted area is fixed beforehand from the typical climate and the well's m³/day cap applies during the peak period, so hotter years and saltier water first cut leaching, then crop water (FAO-33 Ky).

![robustness](figures/06_robustness.png)

| plan | robustness_% | historical | warm1 | warm2 | dry10 | dry20 | ecw1 | ecw2 | worst_cause |
|---|---|---|---|---|---|---|---|---|---|
| current | 96.0 | 94.5 | 95.5 | 95.5 | 97.0 | 98.5 | 95.5 | 95.5 | salt_buildup |
| max_profit | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | none |
| min_water | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | none |
| best_soil | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | none |
| compromise | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | none |

**Reading.** Robustness is high for most plans: in this hyper-arid site rain is a tiny share of the water balance (so −20 % rain barely matters), and when the full FAO-29 leaching water is applied the yield stays near potential. The price of heat and salinity is paid in *water per feddan* (fewer feddan the well can irrigate), which the optimiser already counts. The plans that fail most often do so through salt build-up after unirrigated summer fallows.

## Example card — balanced compromise (English)

**why**
- Best overall score (TOPSIS) for your priorities 'balanced': profit 25%, water saving 25%, salt tolerance 20%.
- Sequence: barley → fallow → barley forage → fallow → barley forage → fallow. Every crop keeps ≥ 96% of its potential yield at your well's 8.35 dS/m when the leaching water is applied.

**evidence**
- NASA POWER 1981–2025 (CERES radiation; MERRA-2 temperature, humidity, wind, rain) at the DRC Ras Sudr pixel: FAO-56 reference ET 1,912 mm/yr vs only 47 mm/yr of rain.
- Summer days above 35 °C: 28 per year on average (POWER T2M_MAX); MERRA-2 root-zone wetness (GWETROOT) in summer ≈ 0.29 — the soil is dry without irrigation.
- Stress test on 1,400 simulated 3-year futures (45 years of NASA climate, +1/+2 °C, −10/−20% rain, saltier well): this plan held up in 100% of them.
- Satellite layers (Sentinel-2/Landsat NDVI, SMAP, GPM IMERG, MODIS, SRTM, GRACE, CMIP6) are coded and will be added once Earth Engine access is enabled.
- Yields calibrated on the DRC Ras Sudr barley trial (S1: 4,215 kg/ha at ECw 8.35); soil salinity on S4 (ECe 8.56 at ECw 7.94).

**benefits**
- Output -4% vs your current rotation.
- Saves 10% water (13,655 vs 15,260 m³ in 3 years).
- Leaves less salt in the root zone: ECe 7.0 vs 7.6 dS/m after 3 years.
- Soil score 55/100 vs 52.

**gaps**
- Crop prices and costs are not in the data yet (data/prices_egp.csv is blank): plans are ranked by an output index, not money.
- How fast salt rises in an unirrigated summer fallow is not measured locally (assumed +5% per season).
- Satellite field history (NDVI) for your exact field is pending; the plan uses station-level data.

**risks**
- Measure THIS well's salinity (ECw) every season — Ras Sudr wells range from 3 to 38 dS/m and the 'highly saline' share of the aquifer rose from 52% (1996) to 83% (2022).
- Barley (forage) (W2, W3) needs 39% extra water for leaching; without it the yield could fall to about 53% (FAO-29 at LF 15%).
- Decision support only — confirm with your local agricultural extension officer.

## نفس الكارت بالعربي

**why**
- أعلى درجة إجمالية (TOPSIS) حسب أولوياتك 'متوازن': الربح 25٪، توفير المية 25٪، تحمل الملوحة 20٪.
- الترتيب: شعير ← بور (راحة) ← شعير علف ← بور (راحة) ← شعير علف ← بور (راحة). كل محصول بيحافظ على 96٪ على الأقل من إنتاجه الممكن مع ملوحة البير 8.35 dS/m لو اتعملت مية الغسيل.

**evidence**
- بيانات ناسا POWER من 1981 لـ 2025 (إشعاع CERES؛ حرارة ورطوبة ورياح ومطر MERRA-2) عند محطة رأس سدر: البخر-نتح المرجعي FAO-56 حوالي 1,912 مم/سنة والمطر 47 مم/سنة بس.
- أيام الصيف اللي فوق 35° حوالي 28 يوم في السنة (POWER T2M_MAX)؛ رطوبة منطقة الجذور (GWETROOT) في الصيف ≈ 0.29 — الأرض ناشفة من غير ري.
- اختبار تحمّل على 1,400 سيناريو لـ 3 سنين (45 سنة مناخ ناسا، +1/+2 درجة، مطر أقل 10/20٪، بير أملح): الخطة نجحت في 100٪ منهم.
- طبقات الأقمار الصناعية (NDVI من Sentinel-2/Landsat، SMAP، IMERG، MODIS، SRTM، GRACE، CMIP6) جاهزة في الكود وهتتضاف أول ما يتفعل Earth Engine.
- الإنتاجية متظبطة على تجربة الشعير في محطة رأس سدر (S1: 4215 كجم/هكتار بملوحة مية 8.35)؛ وملوحة التربة على S4 (ECe 8.56 مع مية 7.94).

**benefits**
- الإنتاج -4% مقارنة بدورتك الحالية.
- بيوفر 10٪ مية (13,655 مقابل 15,260 م³ في 3 سنين).
- بيسيب ملح أقل في منطقة الجذور: ECe 7.0 مقابل 7.6 dS/m بعد 3 سنين.
- درجة التربة 55/100 مقابل 52.

**gaps**
- أسعار المحاصيل والتكاليف لسه مش موجودة (data/prices_egp.csv فاضي): الخطط مترتبة بمؤشر إنتاج مش بفلوس.
- سرعة زيادة الملح في البور الصيفي مش متقاسة محليًا (مفترضة +5٪ كل موسم).
- تاريخ الحقل بالأقمار الصناعية (NDVI) لأرضك بالظبط لسه؛ الخطة مبنية على بيانات المحطة.

**risks**
- قيس ملوحة البير بتاعك (ECw) كل موسم — آبار رأس سدر من 3 لـ 38 dS/m، ونسبة المية 'عالية الملوحة' زادت من 52٪ (1996) لـ 83٪ (2022).
- شعير علف (W2, W3) محتاج 39٪ مية زيادة لغسيل الملح؛ من غيرها الإنتاج ممكن ينزل لحوالي 53٪ (FAO-29 عند LF 15٪).
- ده دعم للقرار بس — راجع المرشد الزراعي في منطقتك قبل التنفيذ.
