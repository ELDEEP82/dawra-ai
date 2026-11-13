"use client";
/** Full-screen hero: rotating Earth that zooms to Ras Sudr, headline, problem line and animated counters. */
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Climate, Evidence, Meta } from "@/lib/types";
import { useLang } from "@/lib/i18n";
import { COPY } from "@/lib/copy";
import { Counter } from "./ui";

const Globe = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => <div className="aspect-square w-full max-w-[560px] rounded-full bg-[radial-gradient(circle_at_35%_35%,#1d3b6b,#050814_70%)]" aria-hidden />,
});

export function Hero({ climate, evidence, meta, onDemo }: { climate: Climate | null; evidence: Evidence | null; meta: Meta | null; onDemo: () => void }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const reduce = useReducedMotion();
  const [zoom, setZoom] = useState(0);
  const [webgl, setWebgl] = useState(false);
  useEffect(() => {
    // load three.js only on wider screens, after first paint, and when motion is allowed
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
  return (
    <section className="relative isolate -mx-4 flex min-h-[calc(100svh-64px)] items-center overflow-hidden px-4" aria-label="Dawra AI">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
        <div className="relative z-10">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-xs uppercase tracking-[0.18em] text-nasa-cyan">
            {c.heroKicker}
          </motion.p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">{c.heroTitle}</h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.35 }} className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
            {c.heroProblem}
          </motion.p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <div className="card p-3 sm:p-4">
              <div className="text-2xl font-semibold text-nasa-cyan sm:text-3xl">{rainPct !== null ? <Counter value={rainPct} nd={1} suffix="%" /> : "—"}</div>
              <div className="mt-1 text-[11px] leading-snug text-slate-400 sm:text-xs">{c.cRain}</div>
            </div>
            <div className="card p-3 sm:p-4">
              <div className="text-2xl font-semibold text-nasa-amber sm:text-3xl">{meta ? <Counter value={meta.farm.well_ECw_dS_m} nd={2} /> : "—"}</div>
              <div className="mt-1 text-[11px] leading-snug text-slate-400 sm:text-xs">{c.cWell}</div>
            </div>
            <div className="card p-3 sm:p-4">
              <div className="text-2xl font-semibold text-nasa-green sm:text-3xl"><Counter value={green2022} /></div>
              <div className="mt-1 text-[11px] leading-snug text-slate-400 sm:text-xs">{c.cGreen}</div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onDemo} className="rounded-full bg-nasa-amber px-5 py-2.5 text-sm font-semibold text-space-950 shadow-glow transition hover:brightness-110">
              {c.ctaDemo}
            </button>
            <Link href="/farmer" className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium transition hover:bg-white/10">
              {c.ctaFarmer}
            </Link>
            <a href="#plans" className="rounded-full px-5 py-2.5 text-sm text-slate-300 underline-offset-4 hover:underline">
              {c.ctaExplore} ↓
            </a>
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-full shadow-[0_0_80px_rgba(76,201,240,.18)]">
          {webgl ? (
            <Globe target={{ lat: 29.6, lon: 32.7 }} zoom={zoom} className="aspect-square w-full" />
          ) : (
            <div className="relative h-full w-full" role="img" aria-label="Earth from space with Ras Sudr, Egypt marked">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/textures/earth_1024.jpg" alt="" width={1024} height={512} className="h-full w-full object-cover object-[58%_40%] opacity-90" fetchPriority="low" />
              <div className="absolute inset-0 rounded-full shadow-[inset_-40px_-30px_80px_rgba(5,8,20,.9),inset_10px_10px_40px_rgba(76,201,240,.15)]" />
              <span className="absolute left-[56%] top-[40%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-nasa-amber shadow-[0_0_0_6px_rgba(249,199,79,.25)]" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
