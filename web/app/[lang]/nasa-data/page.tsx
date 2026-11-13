"use client";
import { Footer, Header } from "@/components/Chrome";
import { DatasetGrid, EoTiles, SourceList } from "@/components/NasaData";
import { useEvidence, useMeta } from "@/lib/data";
import { useLang } from "@/lib/i18n";

export default function NasaData() {
  const { lang } = useLang();
  const ev = useEvidence();
  const meta = useMeta();
  const ar = lang === "ar";
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1200px] space-y-10 px-4 py-10">
        <div>
          <h1 className="section-title">{ar ? "بيانات ناسا اللي استخدمناها" : "NASA data used"}</h1>
          <p className="muted mt-2 max-w-[70ch]">
            {ar
              ? "كل رقم في دورة جاي من بيانات ناسا، أو مصدر محلي (S1–S18)، أو افتراض مكتوب في data/assumptions.csv. البيانات اتنزلت بـ Google Earth Engine يوم 2026-11-13."
              : "Every number in Dawra comes from NASA data, a local source (S1–S18) or a documented row in data/assumptions.csv. Earth-observation data were pulled with Google Earth Engine on 2026-11-13."}
          </p>
        </div>
        <DatasetGrid evidence={ev.data} />
        <EoTiles evidence={ev.data} />
        <p className="text-sm text-slate-400">
          {ar ? "ECOSTRESS مش موجود في كتالوج Earth Engine العام، فاستخدمنا MODIS بداله." : "ECOSTRESS is not in the public Earth Engine catalog, so MODIS is used instead."}
        </p>
        <section>
          <h2 className="text-lg font-semibold">{ar ? "المصادر المحلية والعلمية" : "Local & scientific sources"}</h2>
          <div className="mt-3"><SourceList meta={meta.data} /></div>
        </section>
        <p className="text-xs text-slate-500">Map imagery: Esri World Imagery. NASA does not endorse this tool. Earth globe texture: NASA Visible Earth (Blue Marble).</p>
      </main>
      <Footer />
    </>
  );
}
