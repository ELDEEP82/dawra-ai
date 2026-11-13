"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Footer, Header, Section } from "@/components/Chrome";
import { Hero } from "@/components/Hero";
import dynamic from "next/dynamic";
import { FarmPanel, type Selection } from "@/components/FarmPanel";
import type { WhatIfState } from "@/components/WhatIf";
import { Glossary } from "@/components/Glossary";
import { StoryHeader } from "@/components/StoryHeader";
import { LazySection, Skeleton } from "@/components/lite";
const PlanCard = dynamic(() => import("@/components/Plans").then((m) => m.PlanCard), { ssr: false, loading: () => <Skeleton className="h-[380px]" /> });
const ComparisonTable = dynamic(() => import("@/components/Plans").then((m) => m.ComparisonTable), { ssr: false, loading: () => <Skeleton className="h-80" /> });

const SatelliteStep = dynamic(() => import("@/components/Story").then((m) => m.SatelliteStep), { ssr: false, loading: () => <Skeleton className="h-[520px]" /> });
const SoilTwin = dynamic(() => import("@/components/Story").then((m) => m.SoilTwin), { ssr: false, loading: () => <Skeleton className="h-72" /> });
const SearchViz = dynamic(() => import("@/components/Story").then((m) => m.SearchViz), { ssr: false, loading: () => <Skeleton className="h-80" /> });
const StressViz = dynamic(() => import("@/components/Story").then((m) => m.StressViz), { ssr: false, loading: () => <Skeleton className="h-72" /> });
const WhatIf = dynamic(() => import("@/components/WhatIf").then((m) => m.WhatIf), { ssr: false, loading: () => <Skeleton className="h-96" /> });
const ClimateSnapshot = dynamic(() => import("@/components/ClimateSnapshot").then((m) => m.ClimateSnapshot), { ssr: false, loading: () => <Skeleton className="h-96" /> });
import { plansFor, prefetch, useAfterPaint, useClimate, useConfig, useEvidence, useMapData, useMeta } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { COPY } from "@/lib/copy";

const DEMO_MS = 4300; // 7 steps ≈ 30 s

export default function Home() {
  const { t, lang } = useLang();
  const c = COPY[lang];
  const meta = useMeta();
  const climate = useClimate();
  const later = useAfterPaint();
  const evidence = useEvidence(later);
  const map = useMapData(later);
  const [sel, setSel] = useState<Selection>({ ecw: 8.35, water: 60, profile: "this_farmer" });
  const config = useConfig(sel.ecw, sel.water, later);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [wi, setWi] = useState<WhatIfState>({ kind: "compromise", dT: 0, dRain: 0, dECw: 0, leach: 100 });
  const [playing, setPlaying] = useState(false);
  const [demo, setDemo] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plans = useMemo(() => (config.data ? plansFor(config.data, sel.profile) : null), [config.data, sel.profile]);

  useEffect(() => {
    if (!meta.data) return;
    const f = meta.data.farm;
    setSel((s) => ({ ...s, ecw: f.well_ECw_dS_m, water: f.water_m3_per_day }));
  }, [meta.data]);

  useEffect(() => {
    if (!meta.data) return;
    const id = setTimeout(() => {
      meta.data!.ecw_options.forEach((e) => prefetch(e, sel.water));
      meta.data!.water_options.forEach((w) => prefetch(sel.ecw, w));
    }, 1500);
    return () => clearTimeout(id);
  }, [meta.data, sel.ecw, sel.water]);

  // ---------------------------------------------------------------- 30-second demo
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const runStep = useCallback(
    (i: number) => {
      const f = meta.data?.farm;
      if (i === 0) window.scrollTo({ top: 0, behavior: "smooth" });
      if (i === 1) {
        go("story-sat");
        setPlaying(true);
      }
      if (i === 2) go("story-twin");
      if (i === 3) go("story-search");
      if (i === 4) {
        if (f) setSel({ ecw: f.well_ECw_dS_m, water: f.water_m3_per_day, profile: "this_farmer" });
        setOpen({ compromise: true });
        go("plans");
      }
      if (i === 5) {
        setWi({ kind: "compromise", dT: 0, dRain: 0, dECw: 0, leach: 100 });
        go("whatif");
        setTimeout(() => setWi({ kind: "compromise", dT: 1, dRain: -10, dECw: 1, leach: 70 }), 1300);
        setTimeout(() => setWi({ kind: "compromise", dT: 2, dRain: -20, dECw: 2, leach: 70 }), 2800);
      }
      if (i === 6) go("footer-anchor");
    },
    [meta.data],
  );
  useEffect(() => {
    if (demo === null) return;
    runStep(demo);
    timer.current = setTimeout(() => setDemo((d) => (d === null || d >= 6 ? null : d + 1)), DEMO_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [demo, runStep]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") setTimeout(() => setDemo(0), 1200);
  }, []);
  const hl = (i: number) => demo === i;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl space-y-24 px-4 pb-8">
        <Hero climate={climate.data} evidence={evidence.data} meta={meta.data} />

        <Section id="story" title={c.storyTitle} lead={c.storyLead}>
          <div className="space-y-16">
            <div id="story-sat" className={`scroll-mt-24 space-y-4 rounded-3xl ${hl(1) ? "demo-ring p-2" : ""}`}>
              <StoryHeader title={c.s1Title} lead={c.s1Lead} />
              <LazySection minHeight={560}>{map.data ? <SatelliteStep map={map.data} evidence={evidence.data} playing={playing} onPlaying={setPlaying} /> : <Skeleton className="h-[520px]" />}</LazySection>
            </div>
            <div id="story-twin" className={`scroll-mt-24 space-y-4 rounded-3xl ${hl(2) ? "demo-ring p-2" : ""}`}>
              <StoryHeader title={c.s2Title} lead={c.s2Lead} />
              <LazySection minHeight={340}>{plans ? <SoilTwin plans={plans} /> : <Skeleton className="h-72" />}</LazySection>
            </div>
            <div id="story-search" className={`scroll-mt-24 space-y-4 rounded-3xl ${hl(3) ? "demo-ring p-2" : ""}`}>
              <StoryHeader title={c.s3Title} lead={c.s3Lead} />
              <LazySection minHeight={420}>{config.data && plans ? <SearchViz file={config.data} plans={plans} /> : <Skeleton className="h-80" />}</LazySection>
            </div>
            <div id="story-stress" className="scroll-mt-24 space-y-4">
              <StoryHeader title={c.s4Title} lead={c.s4Lead} />
              <LazySection minHeight={380}>{plans ? <StressViz plans={plans} /> : <Skeleton className="h-72" />}</LazySection>
            </div>
          </div>
        </Section>

        <Section id="farm" title={t.farmTitle} lead={t.farmLead}>
          {meta.data ? <FarmPanel meta={meta.data} sel={sel} onChange={setSel} /> : <Skeleton className="h-72" />}
        </Section>

        <Section id="plans" title={c.plansTitle} lead={c.plansLead} highlight={hl(4)}>
          {config.error && <p className="text-rose-300">{config.error}</p>}
          {!plans && !config.error && <div className="grid gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-72" />)}</div>}
          {plans && (
            <LazySection minHeight={900}>
            <div className={`space-y-8 transition-opacity ${config.loading ? "opacity-60" : ""}`}>
              <div className="grid gap-4 lg:grid-cols-2">
                {plans.map((p, i) => (
                  <PlanCard key={p.kind} p={p} index={i} meta={meta.data} open={!!open[p.kind]} onToggle={() => setOpen((o) => ({ ...o, [p.kind]: !o[p.kind] }))} highlight={hl(4) && p.kind === "compromise"} />
                ))}
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">{t.compareTitle}</h3>
                <ComparisonTable plans={plans} />
              </div>
            </div>
            </LazySection>
          )}
        </Section>

        <Section id="whatif" title={c.labTitle} lead={c.labLead} highlight={hl(5)}>
          <LazySection minHeight={460}>{plans && meta.data ? <WhatIf plans={plans} meta={meta.data} state={wi} onChange={setWi} /> : <Skeleton className="h-96" />}</LazySection>
        </Section>

        <Section id="snapshot" title={t.snapshot}>
          <LazySection minHeight={600}>{climate.data ? <ClimateSnapshot c={climate.data} eo={evidence.data?.eo} /> : <Skeleton className="h-96" />}</LazySection>
        </Section>

        <Section id="glossary" title={t.glossaryTitle}>
          <Glossary />
        </Section>
        <div id="footer-anchor" />
      </main>
      <Footer />

      {demo !== null && (
        <div className="fixed inset-x-0 bottom-4 z-[2000] flex justify-center px-4" role="status" aria-live="polite">
          <div className="w-full max-w-2xl rounded-card border border-line bg-paper/95 p-4 shadow-lift backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-paper" dir="ltr">{demo + 1}/7</span>
              <p className="text-base font-medium">{c.demoSteps[demo]}</p>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded bg-white/10">
              <div key={demo} className="h-full bg-brand" style={{ width: "100%", animation: `demoBar ${DEMO_MS}ms linear` }} />
            </div>
          </div>
          <style>{`@keyframes demoBar { from { width: 0% } to { width: 100% } }`}</style>
        </div>
      )}
    </>
  );
}
