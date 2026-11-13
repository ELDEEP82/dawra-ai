"use client";
import { Footer, Header } from "@/components/Chrome";
import { FlipCard } from "@/components/ui";
import { useEvidence, useMeta } from "@/lib/data";
import { fmt, useLang } from "@/lib/i18n";

type Row = { name: string; provider: string; res: string; period: string; url: string; en: string; ar: string; file?: string };

const ICONS = ["☀️", "🛰️", "🌱", "💧", "🌧️", "🔥", "⛰️", "🌊", "🌡️"];

const DATASETS: Row[] = [
  { name: "NASA POWER daily (AG)", provider: "NASA LaRC — CERES SYN1deg, MERRA-2", res: "0.5° × 0.625°", period: "1981–2026", url: "https://power.larc.nasa.gov/", en: "FAO-56 ET0, effective rain, heat days, root-zone wetness; every stress scenario (45 years).", ar: "البخر-نتح FAO-56، المطر الفعّال، أيام الحر، رطوبة الجذور؛ وكل سيناريوهات التحمّل (45 سنة)." },
  { name: "Landsat 5/7/8/9 Collection 2 L2", provider: "NASA / USGS", res: "30 m", period: "1990–2026", url: "https://developers.google.com/earth-engine/datasets/catalog/landsat", en: "Station NDVI history; yearly green area 1990–2025 (time-lapse on the map; check vs S16).", ar: "تاريخ NDVI للمحطة؛ المساحة الخضرا كل سنة 1990–2025 (على الخريطة؛ ومقارنة بـ S16).", file: "vegetated_area.csv" },
  { name: "Sentinel-2 SR harmonized", provider: "ESA Copernicus (via Earth Engine)", res: "10 m", period: "2017–2026", url: "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED", en: "122 cultivated field polygons; monthly NDVI per field → season labels and rotation guess.", ar: "122 حقل مزروع؛ NDVI شهري لكل حقل ← تصنيف المواسم وتخمين الدورة.", file: "field_ndvi_monthly.csv" },
  { name: "SMAP L4 soil moisture (SPL4SMGP v008)", provider: "NASA GSFC / NSIDC", res: "9 km", period: "2015–2026", url: "https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL4SMGP_008", en: "Surface and root-zone moisture context in the cards (land cells within 15 km).", ar: "رطوبة السطح والجذور في كروت الشرح (خلايا اليابس في حدود 15 كم).", file: "smap_station.csv" },
  { name: "GPM IMERG Final V07", provider: "NASA GSFC / GES DISC", res: "0.1°, 30 min", period: "2001–2025", url: "https://developers.google.com/earth-engine/datasets/catalog/NASA_GPM_L3_IMERG_V07", en: "Daily rain and extreme-rain days; cross-check of POWER rain; rain layer on the map.", ar: "المطر اليومي وأيام المطر الشديد؛ مقارنة بمطر POWER؛ وطبقة المطر على الخريطة.", file: "imerg_station.csv" },
  { name: "MODIS Terra LST (MOD11A2) · ET (MOD16A2GF)", provider: "NASA LP DAAC", res: "1 km / 500 m", period: "2000–2026", url: "https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD11A2", en: "Summer land-surface heat (map layer, cards). MOD16 ET has no data over this barren plain — documented.", ar: "حرارة سطح الأرض في الصيف (طبقة وكروت). MOD16 ملوش بيانات فوق السهل الصحراوي — متوثّق.", file: "modis_station.csv" },
  { name: "SRTM 1 arc-second", provider: "NASA / USGS", res: "30 m", period: "2000", url: "https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003", en: "Slope and elevation per field; land/sea mask for NDVI.", ar: "الميل والارتفاع لكل حقل؛ وقناع اليابس والبحر لـ NDVI.", file: "srtm_aoi.csv" },
  { name: "GRACE / GRACE-FO mascons", provider: "NASA JPL", res: "~0.5° (≈300 km effective)", period: "2002–2025", url: "https://developers.google.com/earth-engine/datasets/catalog/NASA_GRACE_MASS_GRIDS_V04_MASCON_CRI", en: "Regional water-storage trend (context only — far coarser than one well).", ar: "اتجاه مخزون المية الإقليمي (للسياق بس — أكبر بكتير من بير واحد).", file: "grace_station.csv" },
  { name: "NEX-GDDP-CMIP6", provider: "NASA Earth Exchange", res: "0.25°, daily", period: "1995–2014 vs 2041–2060", url: "https://developers.google.com/earth-engine/datasets/catalog/NASA_GDDP-CMIP6", en: "5-model ensemble monthly Tmax and rain changes (SSP2-4.5, SSP5-8.5) → two stress-test futures.", ar: "تغيّر الحرارة والمطر الشهري من 5 موديلات (SSP2-4.5 و SSP5-8.5) ← مستقبلين في اختبار التحمّل.", file: "cmip6_deltas.csv" },
];

export default function NasaData() {
  const { lang } = useLang();
  const ev = useEvidence();
  const meta = useMeta();
  const ar = lang === "ar";
  const s = ev.data?.eo.summary ?? {};
  const okFile = (f?: string) => !f || ev.data?.earth_engine.some((e) => e.status === "ok") || ev.data?.eo_status === "ok";
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        <div>
          <h1 className="section-title">{ar ? "بيانات ناسا اللي استخدمناها" : "NASA data used"}</h1>
          <p className="muted mt-2 max-w-3xl">
            {ar
              ? "كل رقم في دورة جاي من بيانات ناسا، أو مصدر محلي (S1–S18)، أو افتراض مكتوب في data/assumptions.csv. البيانات اتنزلت بـ Google Earth Engine يوم 2026-11-13."
              : "Every number in Dawra comes from NASA data, a local source (S1–S18) or a documented row in data/assumptions.csv. Earth-observation data were pulled with Google Earth Engine on 2026-11-13."}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DATASETS.map((d, i) => (
            <FlipCard
              key={d.name}
              label={d.name}
              className="h-[230px]"
              front={
                <div className="card relative flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-2xl" aria-hidden>{ICONS[i]}</span>
                    <span className="rounded-full border border-emerald-400/50 bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">{okFile(d.file) ? "✔ " + (ar ? "مستخدم" : "in use") : "⏳"}</span>
                  </div>
                  <h2 className="mt-4 text-base font-semibold leading-snug text-ink" dir="ltr">{d.name}</h2>
                  <p className="mt-1 text-xs text-muted" dir="ltr">{d.provider}</p>
                  <div className="mt-auto flex flex-wrap gap-2 text-[11px]" dir="ltr">
                    <span className="rounded-full bg-space-900 px-2 py-1 text-slate-300">{d.res}</span>
                    <span className="rounded-full bg-space-900 px-2 py-1 text-slate-300">{d.period}</span>
                  </div>
                  <span aria-hidden className="absolute bottom-4 end-4 text-xs text-brand">↻</span>
                </div>
              }
              back={
                <div className="card flex h-full flex-col p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand">{ar ? "بيغذّي الموديل في" : "Feeds the model"}</div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{ar ? d.ar : d.en}</p>
                  <a href={d.url} target="_blank" rel="noreferrer" className="mt-auto inline-flex min-h-[44px] items-center text-sm font-medium text-brand underline-offset-4 hover:underline" dir="ltr">
                    {ar ? "صفحة البيانات ↗" : "Dataset page ↗"}
                  </a>
                </div>
              }
            />
          ))}
        </div>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [ar ? "حقول من Sentinel-2" : "Fields from Sentinel-2", s.n_fields as number, ""],
            [ar ? "مطر IMERG (مم/سنة)" : "IMERG rain (mm/yr)", s.imerg_annual_mm as number, ""],
            [ar ? "حرارة سطح الصيف (MODIS)" : "Summer surface temp (MODIS)", s.modis_lst_summer_c as number, " °C"],
            [ar ? "العظمى 2050s SSP5-8.5" : "Tmax 2050s, SSP5-8.5", s.cmip_ssp585_dtmax as number, " °C"],
          ].map(([k, v, u]) => (
            <div key={String(k)} className="card p-4">
              <div className="text-xs text-slate-400">{k}</div>
              <div className="kpi" dir="ltr">{v === undefined || v === null ? "—" : `${String(k).includes("Tmax") || String(k).includes("العظمى") ? "+" : ""}${fmt(Number(v), 1)}${u}`}</div>
            </div>
          ))}
        </section>
        <p className="text-sm text-slate-400">
          {ar ? "ECOSTRESS مش موجود في كتالوج Earth Engine العام، فاستخدمنا MODIS بداله." : "ECOSTRESS is not in the public Earth Engine catalog, so MODIS is used instead."}
        </p>
        <section>
          <h2 className="text-lg font-semibold">{ar ? "المصادر المحلية والعلمية" : "Local & scientific sources"}</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {meta.data?.sources.map((src) => (
              <li key={src.id} className="card p-3" dir="ltr">
                <span className="me-2 font-semibold text-nasa-cyan">{src.id}</span>
                {src.reference}{" "}
                <a href={src.url} target="_blank" rel="noreferrer" className="break-all text-slate-400 underline-offset-4 hover:underline">link</a>
              </li>
            ))}
            <li className="card p-3" dir="ltr">
              <span className="me-2 font-semibold text-nasa-cyan">FAO</span>FAO-56 crop evapotranspiration; FAO-29 water quality for agriculture; FAO-33 yield response to water.
            </li>
            <li className="card p-3" dir="ltr">
              <span className="me-2 font-semibold text-nasa-cyan">Prices</span>2025–26 Egyptian prices & costs (Ahram, Masrawy, Al-Mal, Obour market, FAOSTAT) — see data/prices_egp.csv; estimates are flagged.
            </li>
          </ol>
          {meta.data && <p className="mt-3 text-xs text-slate-500">{ar ? "افتراضات موثّقة" : "Documented assumptions"}: {meta.data.n_assumptions} · {ar ? "آخر بناء" : "built"} {meta.data.built_utc}</p>}
        </section>
        <p className="text-xs text-slate-500">Map imagery: Esri World Imagery. NASA does not endorse this tool. Earth globe texture: NASA Visible Earth (Blue Marble).</p>
      </main>
      <Footer />
    </>
  );
}
