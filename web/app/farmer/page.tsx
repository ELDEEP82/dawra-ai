"use client";
/** Farmer mode: three big questions → one recommended 3-year rotation in plain words (Arabic first). */
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Footer, Header } from "@/components/Chrome";
import { FARMER_PROFILE, plansFor, useConfig, useMeta } from "@/lib/data";
import { fmt, useLang } from "@/lib/i18n";
import { cropStyle } from "@/lib/crops";

type Q = { ecw: number | null; water: number | null; goal: string | null };

const T = {
  ar: {
    title: "وضع المزارع",
    sub: "3 أسئلة بس، وهنقولك تزرع إيه في الـ 3 سنين الجاية.",
    q1: "مية البير بتاعك مالحة قد إيه؟",
    q2: "البير بيديك كام متر مكعب مية في اليوم؟",
    q3: "إيه أهم حاجة ليك؟",
    ecw: [["5", "خفيفة", "زي آبار وادي وردان"], ["6.5", "متوسطة", ""], ["8.35", "زي محطة رأس سدر", "لو مش عارف اختار دي"], ["10", "مالحة", ""], ["12", "مالحة جدًا", "زي آبار الشمال"]],
    water: [["40", "قليلة", "40 م³"], ["60", "متوسطة", "60 م³"], ["90", "كتير", "90 م³"]],
    goals: [["money", "💰", "الفلوس"], ["water", "💧", "توفير المية"], ["soil", "🌱", "صحة الأرض"]],
    result: "ننصحك بالدورة دي",
    profit: "هتكسب تقريبًا",
    perYear: "جنيه في السنة",
    waterUse: "هتستخدم",
    m3y: "م³ مية في السنة",
    soilBetter: "الأرض هتبقى أقل ملوحة",
    soilWorse: "خلي بالك: الملح ممكن يزيد",
    safe: "آمنة",
    medium: "متوسطة",
    risky: "فيها مخاطرة",
    safety: "قوة الخطة في السنين الصعبة",
    vsNow: "مقارنة باللي بتزرعه دلوقتي",
    more: "أكتر",
    less: "أقل",
    careful: "خلي بالك",
    again: "ابدأ تاني",
    expert: "عايز التفاصيل؟ افتح وضع الخبير",
    winter: "شتا",
    summer: "صيف",
    year: "السنة",
    fallow: "سيبها ترتاح",
    ask: "قبل ما تزرع، اسأل المرشد الزراعي في منطقتك.",
  },
  en: {
    title: "Farmer mode",
    sub: "Three questions, one 3-year plan.",
    q1: "How salty is your well water?",
    q2: "How many cubic metres does your well give per day?",
    q3: "What matters most to you?",
    ecw: [["5", "Light", "like W. Wardan wells"], ["6.5", "Medium", ""], ["8.35", "Like the DRC station", "choose this if unsure"], ["10", "Salty", ""], ["12", "Very salty", "like northern wells"]],
    water: [["40", "Little", "40 m³"], ["60", "Medium", "60 m³"], ["90", "Plenty", "90 m³"]],
    goals: [["money", "💰", "Money"], ["water", "💧", "Saving water"], ["soil", "🌱", "Healthy soil"]],
    result: "We suggest this rotation",
    profit: "You could earn about",
    perYear: "EGP a year",
    waterUse: "You will use",
    m3y: "m³ of water a year",
    soilBetter: "Your soil will get less salty",
    soilWorse: "Careful: salt may build up",
    safe: "Safe",
    medium: "Medium",
    risky: "Risky",
    safety: "How it holds up in bad years",
    vsNow: "compared with what you grow now",
    more: "more",
    less: "less",
    careful: "Be careful",
    again: "Start again",
    expert: "Want the details? Open expert mode",
    winter: "Winter",
    summer: "Summer",
    year: "Year",
    fallow: "Let it rest",
    ask: "Before planting, ask your local agricultural extension officer.",
  },
};

function Big({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`rounded-2xl border-2 p-4 text-start text-xl font-semibold transition sm:p-5 sm:text-2xl ${on ? "border-nasa-amber bg-nasa-amber/15" : "border-white/15 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

export default function Farmer() {
  const { lang, setLang } = useLang();
  const L = T[lang];
  const meta = useMeta();
  const [q, setQ] = useState<Q>({ ecw: null, water: null, goal: null });
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("lang") !== "en") setLang("ar");
  }, [setLang]);
  const cfg = useConfig(q.ecw ?? 8.35, q.water ?? 60, q.water !== null);
  const plans = useMemo(() => (cfg.data && q.goal ? plansFor(cfg.data, FARMER_PROFILE[q.goal]) : null), [cfg.data, q.goal]);
  const rec = plans?.find((p) => p.kind === "compromise");
  const cur = plans?.find((p) => p.kind === "current");
  const step = q.ecw === null ? 1 : q.water === null ? 2 : q.goal === null ? 3 : 4;
  const rob = rec?.robustness.robustness_pct ?? 0;
  const robLabel = rob >= 70 ? `✔ ${L.safe}` : rob >= 40 ? `▲ ${L.medium}` : `✖ ${L.risky}`;
  const robColor = rob >= 70 ? "text-emerald-300" : rob >= 40 ? "text-amber-300" : "text-rose-300";
  const area = meta.data?.farm.area_feddan ?? 5;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{L.title}</h1>
          <p className="mt-2 text-lg text-slate-300">{L.sub}</p>
          <div className="mt-4 flex gap-2" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-nasa-amber" : "bg-white/10"}`} />
            ))}
          </div>
        </div>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.section key="q1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="text-2xl font-semibold">🧂 {L.q1}</h2>
              <div className="grid gap-3">
                {L.ecw.map(([v, a, b]) => (
                  <Big key={v} on={q.ecw === Number(v)} onClick={() => setQ({ ...q, ecw: Number(v) })}>
                    {a} <span className="text-base font-normal text-slate-400" dir="ltr">· {v} dS/m</span>
                    {b && <span className="block text-base font-normal text-slate-400">{b}</span>}
                  </Big>
                ))}
              </div>
            </motion.section>
          )}
          {step === 2 && (
            <motion.section key="q2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="text-2xl font-semibold">💧 {L.q2}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {L.water.map(([v, a, b]) => (
                  <Big key={v} on={q.water === Number(v)} onClick={() => setQ({ ...q, water: Number(v) })}>
                    {a}
                    <span className="block text-base font-normal text-slate-400" dir="ltr">{b}</span>
                  </Big>
                ))}
              </div>
            </motion.section>
          )}
          {step === 3 && (
            <motion.section key="q3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <h2 className="text-2xl font-semibold">🎯 {L.q3}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {L.goals.map(([v, icon, a]) => (
                  <Big key={v} on={q.goal === v} onClick={() => setQ({ ...q, goal: v })}>
                    <span className="block text-4xl" aria-hidden>{icon}</span>
                    {a}
                  </Big>
                ))}
              </div>
            </motion.section>
          )}
          {step === 4 && (
            <motion.section key="res" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" aria-live="polite">
              <h2 className="text-2xl font-semibold">✅ {L.result}</h2>
              {!rec && <div className="card h-64 animate-pulse" />}
              {rec && cur && (
                <>
                  <div className="space-y-3">
                    {[0, 1, 2].map((y) => (
                      <div key={y} className="card flex items-stretch gap-3 p-3">
                        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-white/5 text-sm text-slate-300">
                          {L.year}
                          <span className="text-2xl font-semibold text-white" dir="ltr">{y + 1}</span>
                        </div>
                        {[rec.seasons[2 * y], rec.seasons[2 * y + 1]].map((s, k) => {
                          const st = cropStyle(s.crop_id);
                          const fallow = s.crop_id === "fallow";
                          return (
                            <div key={s.slot} className="flex min-w-0 flex-1 flex-col gap-1 rounded-xl border border-white/10 p-3 sm:flex-row sm:items-center sm:gap-3" style={fallow ? undefined : { borderColor: st.color }}>
                              <span className="text-3xl sm:text-4xl" aria-hidden>{fallow ? "🟫" : st.icon}</span>
                              <div className="min-w-0">
                                <div className="text-sm text-slate-400">{k === 0 ? `❄️ ${L.winter}` : `☀️ ${L.summer}`}</div>
                                <div className="break-words text-lg font-semibold sm:text-xl">{fallow ? L.fallow : lang === "ar" ? s.crop_ar : s.crop_en.replace(/ \(.+\)/, "")}</div>
                                {!fallow && <div className="whitespace-nowrap text-sm text-slate-400"><bdi>{fmt(s.area_fdn, 1)}/{fmt(area)}</bdi> {lang === "ar" ? "فدان" : "feddan"}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="card p-4">
                      <div className="text-sm text-slate-400">💰 {L.profit}</div>
                      <div className="text-3xl font-semibold tabular-nums" dir="ltr">{fmt(rec.totals.value / 3 / 1000)}k</div>
                      <div className="text-sm text-slate-400">{L.perYear}</div>
                      {rec.totals.value_vs_current_pct !== null && Math.abs(rec.totals.value_vs_current_pct) >= 1 && (
                        <div className={`mt-1 text-sm ${rec.totals.value_vs_current_pct > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                          <bdi>{fmt(Math.abs(rec.totals.value_vs_current_pct))}%</bdi> {rec.totals.value_vs_current_pct > 0 ? L.more : L.less} · {L.vsNow}
                        </div>
                      )}
                    </div>
                    <div className="card p-4">
                      <div className="text-sm text-slate-400">💧 {L.waterUse}</div>
                      <div className="text-3xl font-semibold tabular-nums" dir="ltr">{fmt(rec.totals.water_m3_per_year)}</div>
                      <div className="text-sm text-slate-400">{L.m3y}</div>
                      {Math.abs(rec.totals.water_vs_current_pct) >= 1 && (
                        <div className={`mt-1 text-sm ${rec.totals.water_vs_current_pct < 0 ? "text-emerald-300" : "text-amber-300"}`}>
                          <bdi>{fmt(Math.abs(rec.totals.water_vs_current_pct))}%</bdi> {rec.totals.water_vs_current_pct > 0 ? L.more : L.less} · {L.vsNow}
                        </div>
                      )}
                    </div>
                    <div className="card p-4">
                      <div className="text-sm text-slate-400">🛡 {L.safety}</div>
                      <div className={`text-3xl font-semibold ${robColor}`}>{robLabel}</div>
                      <div className="text-sm text-slate-400" dir="ltr">{fmt(rob)}%</div>
                    </div>
                  </div>
                  <div className={`card p-4 text-lg ${rec.totals.ECe_end <= 8.56 ? "text-emerald-200" : "text-amber-200"}`}>
                    🌱 {rec.totals.ECe_end <= 8.56 ? L.soilBetter : L.soilWorse}
                  </div>
                  <div className="card p-4">
                    <div className="text-lg font-semibold">⚠️ {L.careful}</div>
                    <ul className="mt-2 list-disc space-y-2 ps-6 text-base text-slate-200">
                      {rec.view.explanation[lang].risks.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="rounded-xl border border-nasa-amber/40 bg-nasa-amber/10 p-4 text-lg text-sand-ink">👨‍🌾 {L.ask}</p>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => setQ({ ecw: null, water: null, goal: null })} className="rounded-full border border-white/20 px-5 py-3 text-lg">↺ {L.again}</button>
                    <Link href="/#plans" className="rounded-full bg-brand px-5 py-3 text-lg font-semibold text-paper">{L.expert}</Link>
                  </div>
                </>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>
      <Footer />
    </>
  );
}
