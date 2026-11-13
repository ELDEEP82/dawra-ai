"use client";
/** Bilingual UI strings (English / Arabic) and the language context with RTL switching. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "./types";

const EN = {
  brand: "Dawra AI",
  brandSub: "دورة",
  tagline: "Smarter crop rotations for salty, dry farms — powered by NASA data",
  heroLead:
    "Compare your current rotation with three 3-year plans and a balanced pick for you, stress-tested against 45 years of NASA climate, hotter futures and saltier wells.",
  navMap: "Pin & Go",
  navFarm: "Your farm",
  navPlans: "Plans",
  navWhatIf: "What-if",
  navGlossary: "Glossary",
  navNasa: "NASA data used",
  demo: "Demo",
  demoStop: "Stop demo",
  langToggle: "عربي",
  et0: "Reference evapotranspiration",
  rain: "Rain",
  perYear: "per year",
  saline: "Aquifer area 'highly saline'",
  pilot: "Pilot: Ras Sudr, South Sinai, Egypt",
  mapTitle: "Pin & Go — Ras Sudr",
  mapLead: "Satellite basemap of the Ras Sudr plain with the DRC research station. Field polygons from Sentinel-2 appear here once Earth Engine extraction runs.",
  fieldsPending: "Field polygons: pending Earth Engine",
  snapshot: "NASA snapshot",
  annualChart: "Rain vs crop water demand (ET0), 1981–2025",
  monthlyChart: "Monthly temperature — NASA POWER vs local record (S1)",
  monthlyWater: "Monthly rain vs ET0 (mm)",
  soilMoisture: "Root-zone soil wetness (NASA POWER GWETROOT)",
  heatDays: "Days above 35 °C per year",
  ndviTitle: "Field greenness (NDVI) history",
  ndviPending: "Sentinel-2 / Landsat NDVI is coded and will appear after Earth Engine authentication. Meanwhile, soil wetness from NASA POWER is shown.",
  pending: "pending",
  farmTitle: "Your farm",
  farmLead: "Start from the surveyed farm F001, then change the well salinity, water supply and your priorities. Every combination was computed in advance.",
  presets: "Presets",
  presetF001: "F001 as surveyed",
  presetSouth: "Fresher well (south zone)",
  presetNorth: "Salty well (north zone)",
  priorities: "Your priorities",
  wellEcw: "Well water salinity (ECw, dS/m)",
  waterSupply: "Water the well gives (m³/day)",
  area: "Area",
  feddan: "feddan",
  irrigation: "Irrigation",
  livestock: "Livestock",
  lastCrop: "Last crop",
  preferred: "Likes to grow",
  avoid: "Avoids",
  heads: "head",
  plansTitle: "Your plans",
  plansLead: "Your current rotation and four alternatives for the next 3 years (6 seasons). Numbers are for the whole farm over 3 years.",
  pricesPending: "Prices pending: crop prices are not in the data yet, so plans are ranked by an output index (share of the farm's potential harvest), not money.",
  water3y: "Water, 3 years",
  output: "Output index",
  profit: "Net profit",
  soilScore: "Soil score",
  robust: "Robustness",
  vsNow: "vs now",
  showWhy: "Why this plan?",
  hideWhy: "Hide explanation",
  why: "Why suggested",
  evidence: "Evidence (NASA data)",
  benefits: "Benefits",
  gaps: "Information gaps",
  risks: "Risks — check with your extension officer",
  sameAs: "Same plan as",
  compareTitle: "Side-by-side",
  soilTrajTitle: "Soil over the 6 seasons",
  ece: "Soil salinity ECe (dS/m)",
  soc: "Organic carbon (%)",
  nitrogen: "Available N (mg/kg)",
  tradeoffTitle: "All best trade-offs found",
  tradeoffLead: "Each dot is a 3-year plan the optimiser kept (no other plan beats it on output, water and soil at once). Colour = soil score.",
  whatIfTitle: "What if…?",
  whatIfLead: "Move the sliders to see how a plan holds up if it gets hotter, drier, or the well gets saltier. Results come from the precomputed stress test (60 simulated 3-year futures per setting).",
  hotter: "Hotter (°C)",
  drier: "Less rain (%)",
  saltier: "Saltier well (+dS/m)",
  choosePlan: "Plan",
  yieldBySeason: "Relative yield by season (%)",
  baseline: "today's climate",
  thisCase: "this case",
  waterUse: "Water use",
  ecEnd: "Soil salinity after 3 years",
  robustThis: "Plans that keep ≥70 % yield and don't add salt",
  glossaryTitle: "Glossary",
  nasaTitle: "NASA data used",
  footer: "Decision support only — confirm with your local agricultural extension officer.",
  builtWith: "Built for NASA Space Apps Cairo 2026 · Team TerraNex · Challenge: Field Shift",
  slot: "Season",
  crop: "Crop",
  sow: "Sow",
  harvest: "Harvest",
  planted: "Planted",
  yieldKg: "Yield kg/ha",
  relYield: "Rel. yield",
  leaching: "Leaching",
  loading: "Loading…",
  winter: "Winter",
  summer: "Summer",
  fallow: "Fallow",
  scenarios: "Stress-test scenarios",
  worst: "Weakest case",
  of: "of",
  plansWord: "plans",
  feddanShort: "fdn",
  demoSteps: [
    "Ras Sudr, South Sinai: salty wells, 47 mm of rain a year.",
    "NASA POWER: crops here need ~1,900 mm of water a year — 40× the rain.",
    "Farm F001: 5 feddan, a well at 8.35 dS/m, 60 m³ a day.",
    "Dawra compares today's barley–fallow rotation with 4 smarter plans.",
    "Every plan explains itself: why, NASA evidence, benefits, gaps, risks.",
    "Stress test: +2 °C and a saltier well — does the plan still hold?",
    "Decision support only — the farmer and the extension officer decide.",
  ],
};

type Dict = typeof EN;

const AR: Dict = {
  brand: "Dawra AI",
  brandSub: "دورة",
  tagline: "دورات زراعية أذكى للأراضي المالحة والجافة — ببيانات ناسا",
  heroLead:
    "قارن دورتك الحالية بـ 3 خطط لـ 3 سنين وخطة متوازنة على مقاسك، ومتجربين على 45 سنة من مناخ ناسا ومستقبل أحر وآبار أملح.",
  navMap: "حدّد مكانك",
  navFarm: "مزرعتك",
  navPlans: "الخطط",
  navWhatIf: "لو حصل…؟",
  navGlossary: "القاموس",
  navNasa: "بيانات ناسا",
  demo: "عرض سريع",
  demoStop: "وقّف العرض",
  langToggle: "English",
  et0: "احتياج الجو للمية (البخر-نتح المرجعي)",
  rain: "المطر",
  perYear: "في السنة",
  saline: "مساحة الخزان 'عالية الملوحة'",
  pilot: "المنطقة التجريبية: رأس سدر، جنوب سيناء، مصر",
  mapTitle: "حدّد مكانك — رأس سدر",
  mapLead: "صورة أقمار صناعية لسهل رأس سدر ومعاها محطة مركز بحوث الصحراء. حدود الحقول من Sentinel-2 هتظهر هنا أول ما يشتغل Earth Engine.",
  fieldsPending: "حدود الحقول: في انتظار Earth Engine",
  snapshot: "لقطة من بيانات ناسا",
  annualChart: "المطر مقابل احتياج الزرع للمية (ET0)، 1981–2025",
  monthlyChart: "الحرارة الشهرية — ناسا POWER مقابل السجل المحلي (S1)",
  monthlyWater: "المطر الشهري مقابل ET0 (مم)",
  soilMoisture: "رطوبة منطقة الجذور (ناسا POWER GWETROOT)",
  heatDays: "عدد الأيام فوق 35° في السنة",
  ndviTitle: "تاريخ خضرة الحقل (NDVI)",
  ndviPending: "مؤشر NDVI من Sentinel-2 و Landsat جاهز في الكود وهيظهر بعد تفعيل Earth Engine. لحد ما ده يحصل، بنعرض رطوبة التربة من ناسا POWER.",
  pending: "قيد الانتظار",
  farmTitle: "مزرعتك",
  farmLead: "ابدأ من المزرعة F001 زي ما اتسجلت، وبعدين غيّر ملوحة البير وكمية المية وأولوياتك. كل الاحتمالات محسوبة مسبقًا.",
  presets: "اختيارات جاهزة",
  presetF001: "F001 زي ما اتسجلت",
  presetSouth: "بير أقل ملوحة (المنطقة الجنوبية)",
  presetNorth: "بير مالح (المنطقة الشمالية)",
  priorities: "أولوياتك",
  wellEcw: "ملوحة مية البير (ECw، dS/m)",
  waterSupply: "المية اللي البير بيديها (م³/يوم)",
  area: "المساحة",
  feddan: "فدان",
  irrigation: "الري",
  livestock: "المواشي",
  lastCrop: "آخر محصول",
  preferred: "بيحب يزرع",
  avoid: "مش عايز يزرع",
  heads: "رأس",
  plansTitle: "خططك",
  plansLead: "دورتك الحالية و4 بدائل للـ 3 سنين الجاية (6 مواسم). الأرقام للمزرعة كلها على 3 سنين.",
  pricesPending: "الأسعار لسه مش متاحة: أسعار المحاصيل مش موجودة في البيانات، فالخطط مترتبة بمؤشر إنتاج (نسبة من المحصول الممكن للمزرعة) مش بالفلوس.",
  water3y: "المية في 3 سنين",
  output: "مؤشر الإنتاج",
  profit: "صافي الربح",
  soilScore: "درجة التربة",
  robust: "قوة التحمّل",
  vsNow: "مقارنة بدلوقتي",
  showWhy: "ليه الخطة دي؟",
  hideWhy: "اخفي الشرح",
  why: "ليه اتقترحت",
  evidence: "الدليل (بيانات ناسا)",
  benefits: "الفوايد",
  gaps: "معلومات ناقصة",
  risks: "مخاطر — راجعها مع المرشد الزراعي",
  sameAs: "نفس خطة",
  compareTitle: "مقارنة جنب بعض",
  soilTrajTitle: "التربة على مدار 6 مواسم",
  ece: "ملوحة التربة ECe (dS/m)",
  soc: "الكربون العضوي (%)",
  nitrogen: "النيتروجين المتاح (مجم/كجم)",
  tradeoffTitle: "كل أحسن الموازنات اللي اتلقت",
  tradeoffLead: "كل نقطة خطة 3 سنين احتفظ بيها المُحسِّن (مفيش خطة تانية أحسن منها في الإنتاج والمية والتربة مع بعض). اللون = درجة التربة.",
  whatIfTitle: "لو حصل…؟",
  whatIfLead: "حرّك المؤشرات وشوف الخطة هتصمد إزاي لو الجو بقى أحر أو المطر قل أو البير بقى أملح. النتائج من اختبار التحمّل المحسوب مسبقًا (60 مستقبل محتمل لكل إعداد).",
  hotter: "أحر (°م)",
  drier: "مطر أقل (%)",
  saltier: "بير أملح (+dS/m)",
  choosePlan: "الخطة",
  yieldBySeason: "الإنتاج النسبي لكل موسم (%)",
  baseline: "مناخ النهارده",
  thisCase: "الحالة دي",
  waterUse: "استهلاك المية",
  ecEnd: "ملوحة التربة بعد 3 سنين",
  robustThis: "نسبة المرات اللي الإنتاج فيها ≥70٪ ومن غير زيادة ملح",
  glossaryTitle: "القاموس",
  nasaTitle: "بيانات ناسا المستخدمة",
  footer: "ده دعم للقرار بس — راجع المرشد الزراعي في منطقتك قبل التنفيذ.",
  builtWith: "اتعمل لمسابقة ناسا Space Apps القاهرة 2026 · فريق TerraNex · تحدي Field Shift",
  slot: "الموسم",
  crop: "المحصول",
  sow: "الزراعة",
  harvest: "الحصاد",
  planted: "المزروع",
  yieldKg: "الإنتاج كجم/هكتار",
  relYield: "الإنتاج النسبي",
  leaching: "مية الغسيل",
  loading: "جاري التحميل…",
  winter: "شتوي",
  summer: "صيفي",
  fallow: "بور",
  scenarios: "سيناريوهات اختبار التحمّل",
  worst: "أضعف حالة",
  of: "من",
  plansWord: "خطة",
  feddanShort: "ف",
  demoSteps: [
    "رأس سدر، جنوب سيناء: آبار مالحة و47 مم مطر في السنة.",
    "ناسا POWER: الزرع هنا محتاج حوالي 1,900 مم مية في السنة — 40 مرة قد المطر.",
    "المزرعة F001: 5 فدان، بير ملوحته 8.35 dS/m، و60 م³ في اليوم.",
    "دورة بتقارن دورة الشعير والبور الحالية بـ 4 خطط أذكى.",
    "كل خطة بتشرح نفسها: ليه، دليل ناسا، الفوايد، الناقص، والمخاطر.",
    "اختبار تحمّل: +2 درجة وبير أملح — الخطة هتصمد؟",
    "ده دعم للقرار بس — القرار للمزارع والمرشد الزراعي.",
  ],
};

export const DICTS: Record<Lang, Dict> = { en: EN, ar: AR };

export const GLOSSARY: { term: Record<Lang, string>; def: Record<Lang, string> }[] = [
  { term: { en: "ET0 (reference evapotranspiration)", ar: "ET0 (البخر-نتح المرجعي)" },
    def: { en: "How much water the air 'pulls' from a well-watered grass field each day (mm). Computed with the FAO-56 Penman–Monteith formula from NASA POWER weather.", ar: "كمية المية اللي الجو 'بيسحبها' من أرض نجيل متروية كويس كل يوم (مم). بتتحسب بمعادلة FAO-56 بنمان-مونتيث من بيانات طقس ناسا POWER." } },
  { term: { en: "ETc (crop water use)", ar: "ETc (استهلاك المحصول للمية)" },
    def: { en: "ET0 × the crop coefficient Kc for each growth stage.", ar: "ET0 مضروب في معامل المحصول Kc في كل مرحلة نمو." } },
  { term: { en: "NDVI", ar: "NDVI (مؤشر الخضرة)" },
    def: { en: "A satellite 'greenness' index from 0 (bare) to ~0.9 (dense green crop). Its yearly rise and fall shows when a field is cropped or bare.", ar: "مؤشر خضرة من الأقمار الصناعية من 0 (أرض فاضية) لحوالي 0.9 (زرع أخضر كثيف). طلوعه ونزوله خلال السنة بيبيّن الأرض كانت مزروعة ولا بور." } },
  { term: { en: "ECw / ECe", ar: "ECw / ECe" },
    def: { en: "Salinity of irrigation water (ECw) and of the soil (ECe, saturated paste), in dS/m. Higher = saltier. Each crop loses yield above its own ECe threshold.", ar: "ملوحة مية الري (ECw) وملوحة التربة (ECe) بوحدة dS/m. الرقم الأعلى = أملح. كل محصول إنتاجه بيقل لما ملوحة التربة تعدّي حد معين خاص بيه." } },
  { term: { en: "Leaching", ar: "غسيل الأملاح" },
    def: { en: "Giving extra water so salt is pushed below the roots. The leaching requirement (LR) is the share of extra water needed (FAO-29).", ar: "إنك تدّي مية زيادة عشان الملح ينزل تحت الجذور. احتياج الغسيل (LR) هو نسبة المية الزيادة المطلوبة (FAO-29)." } },
  { term: { en: "Soil-moisture anomaly", ar: "شذوذ رطوبة التربة" },
    def: { en: "How much wetter or drier the root zone is than normal for that time of year (NASA POWER GWETROOT now; SMAP once Earth Engine runs).", ar: "قد إيه منطقة الجذور أرطب أو أنشف من المعتاد في نفس الوقت من السنة (GWETROOT من ناسا POWER دلوقتي، و SMAP بعد تشغيل Earth Engine)." } },
  { term: { en: "Robustness", ar: "قوة التحمّل" },
    def: { en: "Share of simulated 3-year futures (past NASA climate years, +1/+2 °C, less rain, saltier well) where every crop keeps ≥70 % of its normal yield and soil salt does not rise.", ar: "نسبة المستقبلات المحتملة لـ 3 سنين (سنين مناخ ناسا اللي فاتت، +1/+2 درجة، مطر أقل، بير أملح) اللي فيها كل محصول بيحافظ على 70٪ على الأقل من إنتاجه العادي والملح في التربة مبيزدش." } },
  { term: { en: "Output index", ar: "مؤشر الإنتاج" },
    def: { en: "Used while prices are missing: sum over the 6 seasons of (share of the farm planted × relative yield). 1.0 = the whole farm at full yield for one season.", ar: "بنستخدمه طول ما الأسعار مش موجودة: مجموع الـ 6 مواسم لـ (نسبة المزرعة المزروعة × الإنتاج النسبي). 1.0 = المزرعة كلها بإنتاج كامل لموسم واحد." } },
  { term: { en: "Fallow", ar: "البور" },
    def: { en: "Leaving the land unplanted for a season. In Ras Sudr's hot summer an unirrigated fallow can let salt build up near the surface.", ar: "إنك تسيب الأرض من غير زرع موسم. في صيف رأس سدر الحر، البور من غير ري ممكن يخلي الملح يتجمع قرب السطح." } },
  { term: { en: "Pareto plan / trade-off", ar: "خطة باريتو / الموازنة" },
    def: { en: "A plan that cannot be improved on one goal (output, water, soil) without getting worse on another.", ar: "خطة مينفعش تتحسن في هدف (الإنتاج، المية، التربة) من غير ما تبوظ في هدف تاني." } },
  { term: { en: "Feddan", ar: "الفدان" },
    def: { en: "Egyptian land unit = 0.42 hectare. 1 mm of water on 1 feddan = 4.2 m³.", ar: "وحدة مساحة مصرية = 0.42 هكتار. 1 مم مية على فدان = 4.2 م³." } },
];

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  dir: "ltr" | "rtl";
}

const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("lang");
      const saved = q ?? localStorage.getItem("dawra-lang");
      if (saved === "ar" || saved === "en") setLangState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    const apply = () => {
      setLangState(l);
      try {
        localStorage.setItem("dawra-lang", l);
      } catch {
        /* storage unavailable */
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("lang", l);
        window.history.replaceState(null, "", url.toString());
      } catch {
        /* ignore */
      }
    };
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return apply();
    root.classList.add("lang-fading"); // cross-fade: fade out, switch language + direction, fade in
    window.setTimeout(() => {
      apply();
      window.setTimeout(() => root.classList.remove("lang-fading"), 40);
    }, 170);
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: DICTS[lang], dir: (lang === "ar" ? "rtl" : "ltr") as "ltr" | "rtl" }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLang outside LangProvider");
  return c;
}

/** Format a number with Western digits and thousands separators (both languages). */
export function fmt(x: number | null | undefined, nd = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return x.toLocaleString("en-US", { maximumFractionDigits: nd, minimumFractionDigits: nd });
}

export function signed(x: number | null | undefined, nd = 0, unit = "%"): string {
  if (x === null || x === undefined) return "—";
  const s = x > 0 ? "+" : x < 0 ? "−" : "±";
  return `${s}${fmt(Math.abs(x), nd)}${unit}`;
}
