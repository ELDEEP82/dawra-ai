"use client";
import { Footer, Header } from "@/components/Chrome";
import { useEvidence, useMeta } from "@/lib/data";
import { useLang } from "@/lib/i18n";

export default function NasaData() {
  const { t, lang } = useLang();
  const ev = useEvidence();
  const meta = useMeta();
  const ar = lang === "ar";
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10">
        <div>
          <h1 className="section-title">{t.nasaTitle}</h1>
          <p className="muted mt-2">
            {ar
              ? "كل رقم في دورة جاي من بيانات ناسا أو من مصدر محلي (S1–S18) أو من افتراض مكتوب في data/assumptions.csv."
              : "Every number in Dawra comes from NASA data, a local source (S1–S18), or a documented row in data/assumptions.csv."}
          </p>
        </div>

        <section>
          <h2 className="text-lg font-semibold">{ar ? "مستخدمة دلوقتي" : "Used now"}</h2>
          <div className="mt-3 space-y-3">
            {ev.data?.used_now.map((d) => (
              <a key={d.name} href={d.url} target="_blank" rel="noreferrer" className="card block p-4 hover:bg-white/[0.07]">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.name}</span>
                  <span className="rounded-full border border-emerald-400/50 px-2 py-0.5 text-[11px] text-emerald-300">✔ {ar ? "مستخدم" : "in use"}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400" dir="ltr">{d.vars}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {ar
                    ? "يومي 1981–2026 عند محطة رأس سدر؛ منه بنحسب البخر-نتح FAO-56 والمطر الفعّال وأيام الحر ورطوبة الجذور، وسيناريوهات اختبار التحمّل."
                    : "Daily 1981–2026 at the Ras Sudr pixel; drives FAO-56 ET0, effective rain, heat days, root-zone wetness and the stress-test scenarios."}
                </p>
              </a>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold">{ar ? "طبقات Earth Engine (الكود جاهز)" : "Earth Engine layers (code ready)"}</h2>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-slate-400">
                  <th className="p-3 text-start">{ar ? "المنتج" : "Product"}</th>
                  <th className="p-3 text-start">{ar ? "البيانات" : "Dataset"}</th>
                  <th className="p-3 text-start">{ar ? "الاستخدام" : "Used for"}</th>
                  <th className="p-3 text-start">{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {ev.data?.earth_engine.map((d) => (
                  <tr key={d.product} className="border-b border-white/5 align-top">
                    <td className="p-3 font-medium">{d.product}</td>
                    <td className="p-3 text-slate-300" dir="ltr">
                      {d.dataset}
                      <div className="text-xs text-slate-500">{d.ee_id}</div>
                    </td>
                    <td className="p-3 text-slate-400" dir="ltr">{d.use}</td>
                    <td className="p-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] ${d.status === "ok" ? "border-emerald-400/50 text-emerald-300" : "border-amber-400/50 text-amber-300"}`}>
                        {d.status === "ok" ? "✔ ok" : `⏳ ${t.pending}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500" dir="ltr">earthengine authenticate → GEE_PROJECT=… → make data → make build</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">{ar ? "المصادر المحلية والعلمية" : "Local & scientific sources"}</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {meta.data?.sources.map((s) => (
              <li key={s.id} className="card p-3" dir="ltr">
                <span className="me-2 font-semibold text-nasa-cyan">{s.id}</span>
                {s.reference}{" "}
                <a href={s.url} target="_blank" rel="noreferrer" className="break-all text-slate-400 underline-offset-4 hover:underline">
                  link
                </a>
              </li>
            ))}
            <li className="card p-3" dir="ltr">
              <span className="me-2 font-semibold text-nasa-cyan">FAO</span>FAO-56 (Allen et al. 1998) crop evapotranspiration; FAO-29 (Ayers &amp; Westcot 1985) water quality for agriculture; FAO-33 yield response to water.
            </li>
          </ol>
          {meta.data && (
            <p className="mt-3 text-xs text-slate-500">
              {ar ? "عدد الافتراضات الموثّقة" : "Documented assumptions"}: {meta.data.n_assumptions} · {ar ? "آخر بناء" : "built"} {meta.data.built_utc}
            </p>
          )}
        </section>
        <p className="text-xs text-slate-500">
          Map imagery: Esri World Imagery (Esri, Maxar, Earthstar Geographics, GIS User Community). NASA does not endorse this tool.
        </p>
      </main>
      <Footer />
    </>
  );
}
