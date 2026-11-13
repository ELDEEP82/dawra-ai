"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Footer, Header, Section } from "@/components/Chrome";
import { ClimateSnapshot, KeyNumbers } from "@/components/ClimateSnapshot";
import { FarmPanel, type Selection } from "@/components/FarmPanel";
import { ComparisonTable, PlanCard, SoilChart, TradeoffChart } from "@/components/Plans";
import { WhatIf, type WhatIfState } from "@/components/WhatIf";
import { Glossary } from "@/components/Glossary";
import { prefetch, useClimate, useEvidence, useMapData, useMeta, usePlans } from "@/lib/data";
import { useLang } from "@/lib/i18n";

const MapPanel = dynamic(() => import("@/components/MapPanel"), {
  ssr: false,
  loading: () => <div className="card h-[380px] animate-pulse sm:h-[460px]" />,
});

const DEMO_MS = 4300; // 7 steps ≈ 30 s

export default function Home() {
  const { t } = useLang();
  const meta = useMeta();
  const climate = useClimate();
  const evidence = useEvidence();
  const map = useMapData();
  const [sel, setSel] = useState<Selection>({ ecw: 8.35, water: 60, profile: "this_farmer" });
  const plans = usePlans(sel.ecw, sel.water, sel.profile);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [wi, setWi] = useState<WhatIfState>({ kind: "compromise", dT: 0, dRain: 0, dECw: 0 });
  const [demo, setDemo] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // initialise from the surveyed farm once meta is in
  useEffect(() => {
    if (meta.data) {
      const f = meta.data.farm;
      setSel((s) => ({ ...s, ecw: f.well_ECw_dS_m, water: f.water_m3_per_day }));
    }
  }, [meta.data]);

  // prefetch neighbouring configurations so switching is instant
  useEffect(() => {
    if (!meta.data) return;
    const { ecw_options, water_options, profiles } = meta.data;
    const id = setTimeout(() => {
      profiles.forEach((p) => prefetch(sel.ecw, sel.water, p.id));
      ecw_options.forEach((e) => prefetch(e, sel.water, sel.profile));
      water_options.forEach((w) => prefetch(sel.ecw, w, sel.profile));
    }, 800);
    return () => clearTimeout(id);
  }, [meta.data, sel]);

  // ---------------------------------------------------------------- demo mode
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const runStep = useCallback(
    (i: number) => {
      const f = meta.data?.farm;
      if (i === 0) go("map");
      if (i === 1) go("snapshot");
      if (i === 2) {
        if (f) setSel({ ecw: f.well_ECw_dS_m, water: f.water_m3_per_day, profile: "this_farmer" });
        go("farm");
      }
      if (i === 3) go("plans");
      if (i === 4) {
        setOpen({ compromise: true });
        setTimeout(() => go("plan-compromise"), 150);
      }
      if (i === 5) {
        setWi({ kind: "compromise", dT: 0, dRain: 0, dECw: 0 });
        go("whatif");
        setTimeout(() => setWi({ kind: "compromise", dT: 1, dRain: -10, dECw: 1 }), 1200);
        setTimeout(() => setWi({ kind: "compromise", dT: 2, dRain: -20, dECw: 2 }), 2600);
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

  const toggleDemo = () => {
    if (demo !== null) {
      setDemo(null);
      return;
    }
    window.scrollTo({ top: 0 });
    setDemo(0);
  };

  const salineShare = (() => {
    const hs = evidence.data?.salinity_classes.find((c) => c.class === "Highly saline");
    return hs ? ([hs.share_1996, hs.share_2022] as [number, number]) : null;
  })();
  const pf = plans.data;
  const hl = (i: number) => demo === i;

  return (
    <>
      <Header onDemo={toggleDemo} demoOn={demo !== null} />
      <main className="mx-auto max-w-7xl space-y-16 px-4 pb-8 pt-8">
        {/* hero */}
        <div className="grid items-end gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-nasa-cyan">{t.pilot}</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{t.tagline}</h1>
            <p className="mt-4 max-w-2xl text-slate-300">{t.heroLead}</p>
          </div>
          {climate.data && <KeyNumbers c={climate.data} salineShare={salineShare} />}
        </div>

        <Section id="map" title={t.mapTitle} lead={t.mapLead} highlight={hl(0)}>
          {map.data ? <MapPanel data={map.data} /> : <div className="card h-[380px] animate-pulse" />}
        </Section>

        <Section id="snapshot" title={t.snapshot} highlight={hl(1)}>
          {climate.data ? <ClimateSnapshot c={climate.data} eoStatus={meta.data?.eo_status ?? "pending"} /> : <p className="muted">{t.loading}</p>}
        </Section>

        <Section id="farm" title={t.farmTitle} lead={t.farmLead} highlight={hl(2)}>
          {meta.data ? <FarmPanel meta={meta.data} sel={sel} onChange={setSel} /> : <p className="muted">{t.loading}</p>}
        </Section>

        <Section id="plans" title={t.plansTitle} lead={t.plansLead} highlight={hl(3)}>
          {pf?.prices_pending && (
            <p className="mb-4 rounded-xl border border-nasa-cyan/30 bg-nasa-cyan/10 px-4 py-2.5 text-sm text-slate-200">ℹ {t.pricesPending}</p>
          )}
          {plans.error && <p className="text-rose-300">{plans.error}</p>}
          {!pf && !plans.error && <p className="muted">{t.loading}</p>}
          {pf && (
            <div className={`space-y-6 transition-opacity ${plans.loading ? "opacity-60" : ""}`}>
              <div className="grid gap-4 lg:grid-cols-2">
                {pf.plans.map((p) => (
                  <PlanCard key={p.kind} p={p} open={!!open[p.kind]} onToggle={() => setOpen((o) => ({ ...o, [p.kind]: !o[p.kind] }))} highlight={hl(4) && p.kind === "compromise"} />
                ))}
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">{t.compareTitle}</h3>
                <ComparisonTable plans={pf.plans} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <SoilChart plans={pf.plans} />
                <TradeoffChart file={pf} />
              </div>
            </div>
          )}
        </Section>

        <Section id="whatif" title={t.whatIfTitle} lead={t.whatIfLead} highlight={hl(5)}>
          {pf && meta.data ? <WhatIf plans={pf.plans} meta={meta.data} state={wi} onChange={setWi} /> : <p className="muted">{t.loading}</p>}
        </Section>

        <Section id="glossary" title={t.glossaryTitle}>
          <Glossary />
        </Section>
        <div id="footer-anchor" />
      </main>
      <Footer />

      {demo !== null && (
        <div className="fixed inset-x-0 bottom-4 z-[2000] flex justify-center px-4" role="status" aria-live="polite">
          <div className="w-full max-w-2xl rounded-2xl border border-nasa-amber/50 bg-space-950/95 p-4 shadow-glow">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-nasa-amber px-2 py-0.5 text-xs font-semibold text-space-950" dir="ltr">
                {demo + 1}/7
              </span>
              <p className="text-base font-medium">{t.demoSteps[demo]}</p>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded bg-white/10">
              <div key={demo} className="h-full bg-nasa-amber" style={{ width: "100%", animation: `demoBar ${DEMO_MS}ms linear` }} />
            </div>
          </div>
          <style>{`@keyframes demoBar { from { width: 0% } to { width: 100% } }`}</style>
        </div>
      )}
    </>
  );
}
