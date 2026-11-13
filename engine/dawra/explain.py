"""M7 — 5-field explanation cards (why · evidence · benefits · gaps · risks) in English and Arabic.

Cards are built only from numbers already computed for the plan (templates, no LLM).
``llm_polish`` is an optional hook that may rephrase text but must keep every number.
"""
from __future__ import annotations

import re
from typing import Callable

from .crop_params import CROP_AR
from .simulate import FALLOW

NUM = re.compile(r"[-+]?\d[\d,]*\.?\d*")
TO_WESTERN = str.maketrans("٠١٢٣٤٥٦٧٨٩٫", "0123456789.")
MINOR_NOTES = {"default FAO-56 stage fractions"}

LOCAL_EVIDENCE = {"barley", "barley_forage", "wheat", "sorghum", "pearl_millet", "sugar_beet", "quinoa", "alfalfa",
                  "triticale", "date_palm"}  # crops with a Ras Sudr reference in the Crops sheet (local_evidence)


def _pct(x: float) -> str:
    return f"{x:+.0f}%"


def _n(x: float, nd: int = 0) -> str:
    return f"{x:,.{nd}f}"


def money(t: dict, lang: str = "en") -> str:
    """Plan value as text: EGP over 3 years when priced, else the output index."""
    if t["value_kind"] == "profit_egp":
        return f"{t['value']:,.0f} EGP" if lang == "en" else f"{t['value']:,.0f} جنيه"
    return f"{t['value']:.2f}"


def crops_text(plan: list[str], lang: str) -> str:
    """'barley → sorghum → …' without repeated perennial continuation."""
    seq = []
    for i, c in enumerate(plan):
        if i and c == plan[i - 1] and c != FALLOW:
            continue
        seq.append(CROP_AR[c] if lang == "ar" else c.replace("_", " "))
    return " ← ".join(seq) if lang == "ar" else " → ".join(seq)


def why(p: dict, cur: dict, ctx: dict) -> tuple[list[str], list[str]]:
    """Why this plan was suggested."""
    t, c = p["totals"], cur["totals"]
    k = p["kind"]
    vk = "output index" if t["value_kind"] == "productivity_index" else "net profit"
    vk_ar = "مؤشر الإنتاج" if t["value_kind"] == "productivity_index" else "صافي الربح"
    en, ar = [], []
    if k == "current":
        en.append("This is what you grow today (winter crop, summer fallow). Every other plan is compared with it.")
        ar.append("دي الدورة اللي بتزرعها النهارده (محصول شتوي وبور في الصيف). كل الخطط التانية بتتقارن بيها.")
    elif k == "max_profit":
        en.append(f"Highest {vk} of all {ctx['n_front']} best-trade-off plans: {money(t)} vs {money(c)} "
                  f"now ({_pct(t['value_vs_current_pct'])}).")
        ar.append(f"أعلى {vk_ar} بين {ctx['n_front']} خطة متوازنة: {money(t, 'ar')} مقابل {money(c, 'ar')} "
                  f"دلوقتي ({_pct(t['value_vs_current_pct'])}).")
    elif k == "min_water":
        en.append(f"Uses the least water among plans that keep at least 80% of today's {vk}: "
                  f"{_n(t['water_m3'])} m³ vs {_n(c['water_m3'])} m³ in 3 years ({_pct(t['water_vs_current_pct'])}).")
        ar.append(f"أقل استهلاك مية بين الخطط اللي بتحافظ على ٨٠٪ على الأقل من {vk_ar} الحالي: "
                  f"{_n(t['water_m3'])} م³ مقابل {_n(c['water_m3'])} م³ في ٣ سنين ({_pct(t['water_vs_current_pct'])}).")
    elif k == "best_soil":
        en.append(f"Best soil-health score among plans that keep at least 80% of today's {vk}: "
                  f"{t['soil_index']:.0f}/100 vs {c['soil_index']:.0f} now (50 = no change).")
        ar.append(f"أحسن درجة لصحة التربة بين الخطط اللي بتحافظ على ٨٠٪ على الأقل من {vk_ar} الحالي: "
                  f"{t['soil_index']:.0f}/١٠٠ مقابل {c['soil_index']:.0f} دلوقتي (٥٠ = من غير تغيير).")
    else:
        w = ctx["weights"]
        top = sorted(w.items(), key=lambda kv: -kv[1])[:3]
        names_en = {"profit": "profit", "water_saving": "water saving", "salt_tolerance": "salt tolerance",
                    "soil_health": "soil", "market_demand": "market", "risk_climate": "weather risk"}
        names_ar = {"profit": "الربح", "water_saving": "توفير المية", "salt_tolerance": "تحمل الملوحة",
                    "soil_health": "التربة", "market_demand": "السوق", "risk_climate": "مخاطر الجو"}
        en.append(f"Best overall score (TOPSIS) for your priorities '{ctx['profile']}': "
                  + ", ".join(f"{names_en[a]} {b * 100:.0f}%" for a, b in top) + ".")
        ar.append(f"أعلى درجة إجمالية (TOPSIS) حسب أولوياتك '{ctx['profile_ar']}': "
                  + "، ".join(f"{names_ar[a]} {b * 100:.0f}٪" for a, b in top) + ".")
    en.append(f"Sequence: {crops_text(p['plan'], 'en')}. Every crop keeps ≥ {t['min_rel_yield']:.0f}% of its "
              f"potential yield at your well's {ctx['ecw']:g} dS/m when the leaching water is applied.")
    ar.append(f"الترتيب: {crops_text(p['plan'], 'ar')}. كل محصول بيحافظ على {t['min_rel_yield']:.0f}٪ على الأقل من "
              f"إنتاجه الممكن مع ملوحة البير {ctx['ecw']:g} dS/m لو اتعملت مية الغسيل.")
    return en, ar


def evidence(p: dict, ctx: dict) -> tuple[list[str], list[str]]:
    """NASA and local evidence behind the plan's numbers."""
    cl = ctx["climate"]
    rob = p.get("robustness") or {}
    en = [f"NASA POWER 1981–2025 (CERES radiation; MERRA-2 temperature, humidity, wind, rain) at the DRC Ras Sudr "
          f"pixel: FAO-56 reference ET {_n(cl['et0_mm'])} mm/yr vs only {_n(cl['rain_mm'])} mm/yr of rain.",
          f"Summer days above 35 °C: {cl['heat_days']:.0f} per year on average (POWER T2M_MAX); "
          f"MERRA-2 root-zone wetness (GWETROOT) in summer ≈ {cl['gwet_summer']:.2f} — the soil is dry without irrigation."]
    ar = [f"بيانات ناسا POWER من ١٩٨١ لـ ٢٠٢٥ (إشعاع CERES؛ حرارة ورطوبة ورياح ومطر MERRA-2) عند محطة رأس سدر: "
          f"البخر-نتح المرجعي FAO-56 حوالي {_n(cl['et0_mm'])} مم/سنة والمطر {_n(cl['rain_mm'])} مم/سنة بس.",
          f"أيام الصيف اللي فوق ٣٥° حوالي {cl['heat_days']:.0f} يوم في السنة (POWER T2M_MAX)؛ رطوبة منطقة الجذور "
          f"(GWETROOT) في الصيف ≈ {cl['gwet_summer']:.2f} — الأرض ناشفة من غير ري."]
    if rob:
        cm = " and CMIP6 2050s futures" if rob.get("cmip6") == "included" else ""
        cm_ar = " ومستقبل الخمسينات من CMIP6" if rob.get("cmip6") == "included" else ""
        en.append(f"Stress test on {rob['n_draws']:,} simulated 3-year futures (45 years of NASA climate, +1/+2 °C, "
                  f"−10/−20% rain, saltier well{cm}, and 100/70/40 % of the leaching water): this plan held up in "
                  f"{rob['robustness_pct']:.0f}% of them.")
        ar.append(f"اختبار تحمّل على {rob['n_draws']:,} سيناريو لـ 3 سنين (45 سنة مناخ ناسا، +1/+2 درجة، مطر أقل "
                  f"10/20٪، بير أملح{cm_ar}، و100/70/40٪ من مية الغسيل): الخطة نجحت في {rob['robustness_pct']:.0f}٪ منهم.")
    if ctx["eo_status"] == "pending":
        en.append("Satellite layers (Sentinel-2/Landsat NDVI, SMAP, GPM IMERG, MODIS, SRTM, GRACE, CMIP6) are coded "
                  "and will be added once Earth Engine access is enabled.")
        ar.append("طبقات الأقمار الصناعية (NDVI من Sentinel-2/Landsat، SMAP، IMERG، MODIS، SRTM، GRACE، CMIP6) "
                  "جاهزة في الكود وهتتضاف أول ما يتفعل Earth Engine.")
    else:
        en.extend(ctx["eo_sentence_en"])
        ar.extend(ctx["eo_sentence_ar"])
    en.append("Yields calibrated on the DRC Ras Sudr barley trial (S1: 4,215 kg/ha at ECw 8.35); soil salinity on "
              "S4 (ECe 8.56 at ECw 7.94).")
    ar.append("الإنتاجية متظبطة على تجربة الشعير في محطة رأس سدر (S1: ٤٢١٥ كجم/هكتار بملوحة مية ٨٫٣٥)؛ "
              "وملوحة التربة على S4 (ECe ٨٫٥٦ مع مية ٧٫٩٤).")
    return en, ar


def benefits(p: dict, cur: dict) -> tuple[list[str], list[str]]:
    """Quantified benefits vs the current rotation."""
    t, c = p["totals"], cur["totals"]
    en, ar = [], []
    if p["kind"] == "current":
        en.append(f"Known system, low risk: {_n(t['water_m3_per_year'])} m³ of water per year, soil score "
                  f"{t['soil_index']:.0f}/100.")
        ar.append(f"نظام انت عارفه ومخاطره قليلة: {_n(t['water_m3_per_year'])} م³ مية في السنة، ودرجة التربة "
                  f"{t['soil_index']:.0f}/١٠٠.")
        return en, ar
    if t["value_vs_current_pct"] is not None and abs(t["value_vs_current_pct"]) >= 1:
        if t["value_kind"] == "profit_egp":
            en.append(f"Net profit {money(t)} in 3 years ({_pct(t['value_vs_current_pct'])} vs your current "
                      f"{money(c)}); ≈ {_n(t['profit_per_feddan_year'])} EGP per feddan per year.")
            ar.append(f"صافي الربح {money(t, 'ar')} في 3 سنين ({_pct(t['value_vs_current_pct'])} مقارنة بـ "
                      f"{money(c, 'ar')} دلوقتي)؛ حوالي {_n(t['profit_per_feddan_year'])} جنيه للفدان في السنة.")
        else:
            en.append(f"Output {_pct(t['value_vs_current_pct'])} vs your current rotation.")
            ar.append(f"الإنتاج {_pct(t['value_vs_current_pct'])} مقارنة بدورتك الحالية.")
    if t.get("egp_per_m3") and c.get("egp_per_m3") and t["egp_per_m3"] > c["egp_per_m3"] * 1.05:
        en.append(f"Earns more per drop: {t['egp_per_m3']:.1f} EGP per m³ vs {c['egp_per_m3']:.1f} now; "
                  f"{t['kg_per_m3']:.2f} kg of product per m³.")
        ar.append(f"بيكسب أكتر من كل نقطة مية: {t['egp_per_m3']:.1f} جنيه للمتر المكعب مقابل {c['egp_per_m3']:.1f} دلوقتي؛ "
                  f"و{t['kg_per_m3']:.2f} كجم محصول لكل م³.")
    if t["water_vs_current_pct"] < -1:
        en.append(f"Saves {abs(t['water_vs_current_pct']):.0f}% water ({_n(t['water_m3'])} vs {_n(c['water_m3'])} m³ "
                  "in 3 years).")
        ar.append(f"بيوفر {abs(t['water_vs_current_pct']):.0f}٪ مية ({_n(t['water_m3'])} مقابل {_n(c['water_m3'])} م³ "
                  "في ٣ سنين).")
    if t["ECe_end"] < c["ECe_end"] - 0.05:
        en.append(f"Leaves less salt in the root zone: ECe {t['ECe_end']:.1f} vs {c['ECe_end']:.1f} dS/m after 3 years.")
        ar.append(f"بيسيب ملح أقل في منطقة الجذور: ECe {t['ECe_end']:.1f} مقابل {c['ECe_end']:.1f} dS/m بعد ٣ سنين.")
    if t["N_end"] > c["N_end"] + 0.5:
        en.append(f"Builds soil nitrogen (legumes): {t['N_end']:.0f} vs {c['N_end']:.0f} mg/kg.")
        ar.append(f"بيزوّد نيتروجين التربة (البقوليات): {t['N_end']:.0f} مقابل {c['N_end']:.0f} مجم/كجم.")
    if t["soil_index"] > c["soil_index"] + 1:
        en.append(f"Soil score {t['soil_index']:.0f}/100 vs {c['soil_index']:.0f}.")
        ar.append(f"درجة التربة {t['soil_index']:.0f}/١٠٠ مقابل {c['soil_index']:.0f}.")
    if t["cropped_seasons"] > c["cropped_seasons"]:
        en.append(f"Covers the soil in {t['cropped_seasons']} of 6 seasons (now {c['cropped_seasons']}) — less bare, "
                  "hot summer fallow.")
        ar.append(f"الأرض مزروعة {t['cropped_seasons']} مواسم من ٦ (دلوقتي {c['cropped_seasons']}) — بور صيفي أقل.")
    if not en:
        en.append("Similar to your current rotation on most measures.")
        ar.append("قريبة من دورتك الحالية في أغلب المقاييس.")
    return en, ar


def gaps(p: dict, ctx: dict) -> tuple[list[str], list[str]]:
    """Assumptions and missing data that matter for this plan."""
    en, ar = [], []
    est = sorted({s["crop_id"] for s in p["seasons"] if s["crop_id"] in ctx.get("price_estimated", set())})
    if not ctx["prices_pending"] and est:
        en.append("Prices/costs are estimates (no 2025-26 Egyptian quote found) for: "
                  + ", ".join(c.replace("_", " ") for c in est) + " — see data/prices_egp.csv.")
        ar.append("الأسعار أو التكاليف تقديرية (ملقيناش سعر مصري 2025-26) لـ: " + "، ".join(CROP_AR[c] for c in est) + ".")
    if ctx["prices_pending"]:
        en.append("Crop prices and costs are not in the data yet (data/prices_egp.csv is blank): plans are ranked by an "
                  "output index, not money.")
        ar.append("أسعار المحاصيل والتكاليف لسه مش موجودة (data/prices_egp.csv فاضي): الخطط مترتبة بمؤشر إنتاج مش بفلوس.")
    crops = {s["crop_id"] for s in p["seasons"] if s["crop_id"] != FALLOW}
    notes = {k: [n for n in v if n not in MINOR_NOTES] for k, v in ctx["crop_notes"].items()}
    flagged = sorted(c for c in crops if notes.get(c))
    if flagged:
        en.append("Parameters partly assumed (see data/assumptions.csv) for: "
                  + ", ".join(f"{c.replace('_', ' ')} ({'; '.join(notes[c])})" for c in flagged) + ".")
        ar.append("بعض المعاملات مفترضة (شوف data/assumptions.csv) لـ: " + "، ".join(CROP_AR[c] for c in flagged) + ".")
    ymax_assumed = sorted(c for c in crops if ctx["ymax_source"].get(c, "").startswith("assumption"))
    if ymax_assumed:
        en.append("Attainable yield is an assumption (no local trial) for: "
                  + ", ".join(c.replace("_", " ") for c in ymax_assumed) + ".")
        ar.append("الإنتاج الممكن مفترض (مفيش تجربة محلية) لـ: " + "، ".join(CROP_AR[c] for c in ymax_assumed) + ".")
    if FALLOW in p["plan"]:
        en.append("How fast salt rises in an unirrigated summer fallow is not measured locally (assumed +5% per season).")
        ar.append("سرعة زيادة الملح في البور الصيفي مش متقاسة محليًا (مفترضة +٥٪ كل موسم).")
    flips = ctx.get("rank_flips") or []
    if flips:
        en.append("This pick is sensitive: a ±20 % change in " + ", ".join(f"`{f}`" for f in flips[:4])
                  + " can change it (sensitivity analysis).")
        ar.append("الاختيار ده حساس: تغيير ±20٪ في " + "، ".join(flips[:4]) + " ممكن يغيّره (تحليل الحساسية).")
    if ctx["eo_status"] == "pending":
        en.append("Satellite field history (NDVI) for your exact field is pending; the plan uses station-level data.")
        ar.append("تاريخ الحقل بالأقمار الصناعية (NDVI) لأرضك بالظبط لسه؛ الخطة مبنية على بيانات المحطة.")
    else:
        en.append("The plan uses the station's climate and soil; your own field's NDVI history is on the map — pick "
                  "your field to compare.")
        ar.append("الخطة مبنية على مناخ وتربة المحطة؛ تاريخ خضرة حقلك موجود على الخريطة — اختار حقلك وقارن.")
    return en, ar


def risks(p: dict, ctx: dict) -> tuple[list[str], list[str]]:
    """Items that need review by the local extension officer."""
    en = ["Measure THIS well's salinity (ECw) every season — Ras Sudr wells range from 3 to 38 dS/m and the 'highly "
          "saline' share of the aquifer rose from 52% (1996) to 83% (2022)."]
    ar = ["قيس ملوحة البير بتاعك (ECw) كل موسم — آبار رأس سدر من ٣ لـ ٣٨ dS/m، ونسبة المية 'عالية الملوحة' زادت من "
          "٥٢٪ (١٩٩٦) لـ ٨٣٪ (٢٠٢٢)."]
    leach: dict[str, dict] = {}
    for s in p["seasons"]:
        if s["crop_id"] != FALLOW and s.get("part") != 1 and s["lr_pct"] >= 30:
            leach.setdefault(s["crop_id"], {**s, "slots": []})["slots"].append(s["slot"])
    for cid, s in leach.items():
        ry_no = ctx["ry_without_leaching"].get(cid, 0)
        slots = ", ".join(s["slots"])
        en.append(f"{s['crop_en']} ({slots}) needs {s['lr_pct']:.0f}% extra water for leaching; without it "
                  f"the yield could fall to about {ry_no:.0f}% (FAO-29 at LF 15%).")
        ar.append(f"{s['crop_ar']} ({slots}) محتاج {s['lr_pct']:.0f}٪ مية زيادة لغسيل الملح؛ من غيرها الإنتاج "
                  f"ممكن ينزل لحوالي {ry_no:.0f}٪ (FAO-29 عند LF 15٪).")
    new = sorted({s["crop_id"] for s in p["seasons"] if s["crop_id"] not in LOCAL_EVIDENCE | {FALLOW}})
    if new:
        en.append("Check seed, know-how and buyers before planting crops without a Ras Sudr track record: "
                  + ", ".join(c.replace("_", " ") for c in new) + ".")
        ar.append("اتأكد من التقاوي والخبرة والمشتري قبل ما تزرع محاصيل ملهاش تجربة في رأس سدر: "
                  + "، ".join(CROP_AR[c] for c in new) + ".")
    fams = [s.get("family") for s in p["seasons"]]
    if any(a and a == b for a, b in zip(fams, fams[1:])):
        en.append("Two seasons in a row of the same plant family: watch for pests and diseases.")
        ar.append("موسمين ورا بعض من نفس العيلة النباتية: خلي بالك من الآفات والأمراض.")
    rob = p.get("robustness") or {}
    bl = {b["leach_pct"]: b for b in rob.get("by_leaching") or []}
    if 70 in bl and 40 in bl:
        en.append(f"If you apply only 70 % / 40 % of the leaching water the plan passes {bl[70]['pass_pct']:.0f}% / "
                  f"{bl[40]['pass_pct']:.0f}% of futures (salt builds up in {bl[70]['salt_buildup_pct']:.0f}% / "
                  f"{bl[40]['salt_buildup_pct']:.0f}%). The S1 trial applied about 60 % of the FAO-29 amount.")
        ar.append(f"لو حطيت 70٪ / 40٪ بس من مية الغسيل الخطة بتنجح في {bl[70]['pass_pct']:.0f}٪ / {bl[40]['pass_pct']:.0f}٪ "
                  f"من الحالات (الملح بيتراكم في {bl[70]['salt_buildup_pct']:.0f}٪ / {bl[40]['salt_buildup_pct']:.0f}٪). "
                  "تجربة S1 حطت حوالي 60٪ من كمية FAO-29.")
    w = rob.get("worst") or {}
    if w and w.get("cause") not in (None, "none"):
        lab = next((b for b in rob["by_scenario"] if b["key"] == w["key"]), {})
        cause_en = {"salt_buildup": "salt builds up in the soil", "heat": "heat during flowering",
                    "low_yield": "low yield"}[w["cause"]]
        cause_ar = {"salt_buildup": "الملح بيتراكم في التربة", "heat": "حرارة وقت التزهير",
                    "low_yield": "إنتاج قليل"}[w["cause"]]
        en.append(f"Weakest case: {lab.get('label_en', w['key'])} — passes {w['pass_pct']:.0f}% of the time; main "
                  f"cause: {cause_en}.")
        ar.append(f"أضعف حالة: {lab.get('label_ar', w['key'])} — بتنجح {w['pass_pct']:.0f}٪ من المرات؛ السبب الأساسي: "
                  f"{cause_ar}.")
    en.append("Decision support only — confirm with your local agricultural extension officer.")
    ar.append("ده دعم للقرار بس — راجع المرشد الزراعي في منطقتك قبل التنفيذ.")
    return en, ar


def card(p: dict, cur: dict, ctx: dict) -> dict:
    """The 5-field explanation card in EN and AR."""
    parts = {"why": why(p, cur, ctx), "evidence": evidence(p, ctx), "benefits": benefits(p, cur),
             "gaps": gaps(p, ctx), "risks": risks(p, ctx)}
    return {"en": {k: v[0] for k, v in parts.items()},
            "ar": {k: [x.translate(TO_WESTERN) for x in v[1]] for k, v in parts.items()}}


def numbers_in(text: str) -> list[str]:
    """All numbers in a text (used to guard LLM rephrasing)."""
    return [m.replace(",", "") for m in NUM.findall(text)]


def llm_polish(text: str, rephrase: Callable[[str], str] | None = None) -> str:
    """Optional rephrasing hook; rejects any output that changes the numbers."""
    if rephrase is None:
        return text
    out = rephrase(text)
    if sorted(numbers_in(out)) != sorted(numbers_in(text)):
        raise ValueError("llm_polish changed the numbers; keeping the template text is required")
    return out
