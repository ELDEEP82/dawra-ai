"use client";
/** Light cinematic hero: 3D Earth zooming to Ras Sudr, word-by-word headline, flip stat cards, scroll cue. */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Climate, Evidence, Meta } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { COPY } from "@/lib/copy";
import { Counter, CssFlip, Magnetic } from "./lite";

const Globe = dynamic(() => import("./Globe"), { ssr: false, loading: () => <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#dfeee7_60%,#cfe3da)]" aria-hidden /> });

function Words({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <span className="word-in inline-block" style={{ animationDelay: `${50 + i * 45}ms` }}>
              {w}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

function StatCard({ value, label, back, tone }: { value: React.ReactNode; label: string; back: string; tone: string }) {
  return (
    <CssFlip
      label={label}
      className="h-[132px]"
      front={
        <div className="card relative flex h-full flex-col justify-between p-4">
          <div className={`text-3xl font-semibold tracking-tight ${tone}`}>{value}</div>
          <div className="text-xs leading-snug text-muted">{label}</div>
          <span aria-hidden className="absolute end-3 top-3 text-[10px] text-slate-600">↻</span>
        </div>
      }
      back={<div className="card flex h-full items-center p-4 text-xs leading-relaxed text-slate-300">{back}</div>}
    />
  );
}

export function Hero({ climate, evidence, meta }: { climate: Climate | null; evidence: Evidence | null; meta: Meta | null }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const ar = lang === "ar";
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  const [zoom, setZoom] = useState(0);
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    if (reduce || !window.matchMedia("(min-width: 640px)").matches) return;
    const t0 = setTimeout(() => setWebgl(true), 900);
    const t1 = setTimeout(() => setZoom(0.6), 3200);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
  }, [reduce]);
  const rainPct = climate ? (climate.summary.rain_mm / climate.summary.et0_mm) * 100 : null;
  const green2022 = evidence?.eo.veg_check.find((r) => r.threshold === 0.25)?.s16_2022 ?? 1579;
  const backs = ar
    ? [
        `المطر ${climate ? Math.round(climate.summary.rain_mm) : "—"} مم/سنة قصاد احتياج الزرع ${climate ? Math.round(climate.summary.et0_mm).toLocaleString("en-US") : "—"} مم/سنة (ناسا POWER 1981–2025، معادلة FAO-56).`,
        "ملوحة مية بير المزرعة F001 (S1). آبار رأس سدر من 3 لـ 38 dS/m، ونسبة المية العالية الملوحة زادت من 52٪ لـ 83٪ (S16).",
        "المساحة الخضرا في سهل رأس سدر في مسح S16 سنة 2022؛ ولاندسات بيبين نفس الزيادة من 1990 لـ 2025.",
      ]
    : [
        `Rain ${climate ? Math.round(climate.summary.rain_mm) : "—"} mm/yr vs crop water need ${climate ? Math.round(climate.summary.et0_mm).toLocaleString("en-US") : "—"} mm/yr (NASA POWER 1981–2025, FAO-56).`,
        "Well salinity of farm F001 (S1). Ras Sudr wells range 3–38 dS/m; the highly-saline aquifer share rose 52 % → 83 % (S16).",
        "Green area of the Ras Sudr plain in the S16 survey (2022); Landsat shows the same rise from 1990 to 2025.",
      ];
  return (
    <section id="hero" className="relative -mx-4 flex min-h-[calc(100svh-64px)] items-center overflow-hidden px-4 pb-16" aria-label="Dawra AI">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.08fr_1fr]">
        <div className="relative z-10">
          <p className="fade-up inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-leaf" aria-hidden />
            {c.heroKicker}
          </p>
          <h1 className="mt-5 text-[clamp(2.75rem,6vw,5rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink rtl:leading-[1.2] rtl:tracking-normal">
            <Words text={c.heroTitle} />
          </h1>
          <p className="fade-up mt-6 max-w-xl text-lg text-slate-300" style={{ animationDelay: "450ms" }}>
            {c.heroProblem}
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <StatCard tone="text-brand-sky" value={rainPct !== null ? <Counter value={rainPct} nd={1} suffix="%" /> : "—"} label={c.cRain} back={backs[0]} />
            <StatCard tone="text-sand-ink" value={meta ? <Counter value={meta.farm.well_ECw_dS_m} nd={2} /> : "—"} label={c.cWell} back={backs[1]} />
            <StatCard tone="text-brand" value={<Counter value={green2022} />} label={c.cGreen} back={backs[2]} />
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Magnetic>
              <a href="#plans" className="btn-primary">{c.ctaExplore} ↓</a>
            </Magnetic>
            <Magnetic>
              <Link href="/farmer" className="btn-ghost">{c.ctaFarmer}</Link>
            </Magnetic>
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[540px]">
          <div aria-hidden className="absolute inset-[-8%] rounded-full bg-[radial-gradient(circle,rgba(43,182,115,.16),transparent_62%)]" />
          <div className="relative h-full w-full overflow-hidden rounded-full border border-line bg-paper shadow-lift">
            {webgl ? (
              <Globe target={{ lat: 29.6, lon: 32.7 }} zoom={zoom} className="aspect-square w-full" />
            ) : (
              <div className="relative h-full w-full" role="img" aria-label="Earth from space with Ras Sudr, Egypt marked">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/textures/earth_1024.jpg" alt="" width={1024} height={512} className="h-full w-full object-cover object-[58%_40%]" fetchPriority="low" />
                <div className="absolute inset-0 rounded-full shadow-[inset_-30px_-24px_70px_rgba(15,107,79,.25),inset_16px_16px_50px_rgba(255,255,255,.35)]" />
                <span className="absolute left-[60.2%] top-[33.6%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sand shadow-[0_0_0_6px_rgba(232,162,58,.3)]" />
              </div>
            )}
          </div>
        </div>
      </div>
      <a
        href="#story"
        aria-label={ar ? "انزل" : "Scroll down"}
        className="fade-up absolute bottom-4 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-xs text-muted sm:flex"
        style={{ animationDelay: "1200ms" }}
      >
        <span className="flex h-9 w-6 justify-center rounded-full border-2 border-slate-600/60 pt-1.5">
          <span className="scroll-dot h-2 w-1 rounded-full bg-brand" />
        </span>
        {ar ? "انزل" : "scroll"}
      </a>
    </section>
  );
}
