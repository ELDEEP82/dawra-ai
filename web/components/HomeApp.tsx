"use client";
/** Home: compact hero + app-style tabs (Your farm · Plans · What-if · Satellite evidence · NASA data) on a bento grid.
 *  The first render is identical on server and client (no hydration warnings); the active tab follows the URL hash. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, BookOpen, Brain, CloudSun, Database, Gauge, Library, SlidersHorizontal, Sprout, Table2, Waves } from "lucide-react";
import { Footer, Header } from "@/components/Chrome";
import { Hero, type HeroData } from "@/components/Hero";
import { FarmPanel, type Selection } from "@/components/FarmPanel";
import type { WhatIfState } from "@/components/WhatIf";
import { Card, CardSkeleton, ErrorBoundary, Shimmer } from "@/components/Card";
import { TABS, TabNav, type TabId } from "@/components/TabNav";
import { onFirstInteraction, onIdle, plansFor, prefetch, prefetchCore, useClimate, useConfig, useEvidence, useMapData, useMeta } from "@/lib/data";
import { fmt, useLang } from "@/lib/i18n";
import { COPY } from "@/lib/copy";
import type { Plan } from "@/lib/types";

const chunks = {
  plans: () => import("@/components/Plans"),
  story: () => import("@/components/Story"),
  whatif: () => import("@/components/WhatIf"),
  climate: () => import("@/components/ClimateSnapshot"),
  map: () => import("@/components/MapPanel"),
  nasa: () => import("@/components/NasaData"),
  glossary: () => import("@/components/Glossary"),
};
const PlanCard = dynamic(() => chunks.plans().then((m) => m.PlanCard), { ssr: false, loading: () => <Shimmer height={420} /> });
const ComparisonTable = dynamic(() => chunks.plans().then((m) => m.ComparisonTable), { ssr: false, loading: () => <Shimmer height={320} /> });
const SatelliteStep = dynamic(() => chunks.story().then((m) => m.SatelliteStep), { ssr: false, loading: () => <EvidenceSkeleton /> });
const SoilTwin = dynamic(() => chunks.story().then((m) => m.SoilTwin), { ssr: false, loading: () => <Shimmer height={300} /> });
const SearchViz = dynamic(() => chunks.story().then((m) => m.SearchViz), { ssr: false, loading: () => <Shimmer height={300} /> });
const StressViz = dynamic(() => chunks.story().then((m) => m.StressViz), { ssr: false, loading: () => <Shimmer height={300} /> });
const WhatIf = dynamic(() => chunks.whatif().then((m) => m.WhatIf), { ssr: false, loading: () => <Shimmer height={420} /> });
const DatasetGrid = dynamic(() => chunks.nasa().then((m) => m.DatasetGrid), { ssr: false, loading: () => <Shimmer height={500} /> });
const EoTiles = dynamic(() => chunks.nasa().then((m) => m.EoTiles), { ssr: false, loading: () => <Shimmer height={96} /> });
const SourceList = dynamic(() => chunks.nasa().then((m) => m.SourceList), { ssr: false });
const Glossary = dynamic(() => chunks.glossary().then((m) => m.Glossary), { ssr: false });
const ClimateSnapshot = dynamic(() => chunks.climate().then((m) => m.ClimateSnapshot), { ssr: false, loading: () => <Shimmer height={600} /> });

const ORDER = ["current", "compromise", "max_profit", "min_water", "best_soil"];
const DEMO_MS = 4300; // 7 steps ≈ 30 s
const isTab = (h: string): h is TabId => TABS.some((t) => t.id === h);

function EvidenceSkeleton() {
  return (
    <>
      <div className="col-span-12 lg:col-span-8"><Shimmer height={560} /></div>
      <div className="col-span-12 grid gap-6 lg:col-span-4"><Shimmer height={330} /><Shimmer height={210} /></div>
    </>
  );
}

function SummaryStrip({ plans, ar }: { plans: Plan[]; ar: boolean }) {
  const cur = plans.find((p) => p.kind === "current");
  const rec = plans.find((p) => p.kind === "compromise");
  if (!cur || !rec) return null;
  const dv = rec.totals.value_vs_current_pct ?? 0, dw = rec.totals.water_vs_current_pct ?? 0;
  const sg = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v));
  const items = [
    { k: ar ? "ربح" : "profit", v: `${sg(dv)} %`, good: dv >= 0 },
    { k: ar ? "مية" : "water", v: `${sg(dw)} %`, good: dw <= 0 },
    { k: ar ? `قوة التحمّل ${fmt(rec.robustness.robustness_pct)} % قصاد ${fmt(cur.robustness.robustness_pct)} % النهارده` : `robustness ${fmt(rec.robustness.robustness_pct)} % vs ${fmt(cur.robustness.robustness_pct)} % today`, v: "", good: rec.robustness.robustness_pct >= cur.robustness.robustness_pct },
  ];
  return (
    <div className="col-span-12 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-brand/25 bg-brand-soft px-5 py-4" data-testid="summary-strip">
      <span className="text-sm font-semibold text-brand">{ar ? "الخطة المقترحة ليك:" : "Recommended plan:"}</span>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-base font-semibold text-ink">
          {i > 0 && <span className="me-2 text-muted" aria-hidden>·</span>}
          {it.v && <bdi dir="ltr" className={it.good ? "text-brand" : "text-brand-risk"}>{it.v}</bdi>}
          <span className={it.v ? "font-medium" : ""}>{it.k}</span>
        </span>
      ))}
    </div>
  );
}

export default function HomeApp({ hero }: { hero: HeroData }) {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  const c = COPY[lang];
  const meta = useMeta();
  const climate = useClimate();
  const [tab, setTab] = useState<TabId>("farm");
  const [dirn, setDirn] = useState(1);
  const [idle, setIdle] = useState(false);
  const evidence = useEvidence(idle || tab === "evidence" || tab === "nasa");
  const map = useMapData(idle || tab === "evidence");
  const [sel, setSel] = useState<Selection>({ ecw: 8.35, water: 60, profile: "this_farmer" });
  const config = useConfig(sel.ecw, sel.water, idle || tab !== "farm");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [wi, setWi] = useState<WhatIfState>({ kind: "compromise", dT: 0, dRain: 0, dECw: 0, leach: 100 });
  const [playing, setPlaying] = useState(false);
  const [demo, setDemo] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plans = useMemo(() => (config.data ? plansFor(config.data, sel.profile) : null), [config.data, sel.profile]);

  // ------------------------------------------------------------------ prefetch everything on idle after first paint
  useEffect(
    () =>
      onIdle(() => {
        setIdle(true);
        prefetchCore(); // JSON only: network + cheap parse, no rendering
      }),
    [],
  );
  // Tab code (charts, map, motion) is warmed on the first interaction so it never competes with the first paint.
  useEffect(() => onFirstInteraction(() => onIdle(() => Object.values(chunks).forEach((f) => void f().catch(() => undefined)), 800)), []);
  useEffect(() => {
    if (!meta.data) return;
    const f = meta.data.farm;
    setSel((s) => ({ ...s, ecw: f.well_ECw_dS_m, water: f.water_m3_per_day }));
  }, [meta.data]);
  // Neighbouring well/water settings are prefetched once the visitor interacts (so a selector click is instant).
  const [engaged, setEngaged] = useState(false);
  useEffect(() => onFirstInteraction(() => setEngaged(true)), []);
  useEffect(() => {
    if (!meta.data || !engaged) return;
    return onIdle(() => {
      meta.data!.ecw_options.forEach((e) => prefetch(e, sel.water));
      meta.data!.water_options.forEach((w) => prefetch(sel.ecw, w));
    }, 4000);
  }, [meta.data, engaged, sel.ecw, sel.water]);

  // ------------------------------------------------------------------ tabs ↔ URL hash (back button works)
  const scrollToTabs = useCallback(() => {
    const el = document.getElementById("app-top");
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);
  const tabRef = useRef<TabId>("farm");
  const show = useCallback((next: TabId) => {
    const idx = (id: TabId) => TABS.findIndex((x) => x.id === id);
    setDirn(idx(next) >= idx(tabRef.current) ? 1 : -1);
    tabRef.current = next;
    setTab(next);
  }, []);
  const go = useCallback(
    (next: TabId, scroll = true) => {
      if (window.location.hash !== `#${next}`) window.history.pushState(null, "", `#${next}`);
      show(next);
      if (scroll) scrollToTabs();
    },
    [show, scrollToTabs],
  );
  useEffect(() => {
    const sync = () => {
      const h = window.location.hash.slice(1);
      if (isTab(h)) show(h);
      else if (!h) show("farm");
    };
    const h = window.location.hash.slice(1);
    if (isTab(h)) {
      show(h);
      requestAnimationFrame(scrollToTabs);
    }
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [show, scrollToTabs]);

  // ------------------------------------------------------------------ 30-second demo (?demo=1 only)
  const focus = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  const runStep = useCallback(
    (i: number) => {
      const f = meta.data?.farm;
      if (i === 0) window.scrollTo({ top: 0, behavior: "smooth" });
      if (i === 1) {
        go("evidence");
        setPlaying(true);
      }
      if (i === 2) {
        go("evidence", false);
        focus("ev-twin");
      }
      if (i === 3) {
        go("evidence", false);
        focus("ev-search");
      }
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
      if (i === 6) go("nasa");
    },
    [meta.data, go],
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

  // ------------------------------------------------------------------ panels
  const panel = (() => {
    switch (tab) {
      case "farm":
        return meta.data ? (
          <FarmPanel meta={meta.data} sel={sel} onChange={setSel} onNext={() => go("plans")} />
        ) : (
          <>
            <CardSkeleton icon={Sprout} title={t.farmTitle} height={300} className="col-span-12 lg:col-span-5" />
            <CardSkeleton icon={SlidersHorizontal} title={t.priorities} height={300} className="col-span-12 lg:col-span-7" />
          </>
        );
      case "plans":
        return (
          <>
            {config.error && (
              <p role="alert" className="col-span-12 text-rose-300">{config.error}</p>
            )}
            {plans ? (
              <>
                <SummaryStrip plans={plans} ar={ar} />
                {[...plans].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)).map((p, i) => (
                  <div key={p.kind} className="col-span-12 md:col-span-6">
                    <ErrorBoundary>
                      <PlanCard p={p} index={i} meta={meta.data} recommended={p.kind === "compromise"} open={!!open[p.kind]} onToggle={() => setOpen((o) => ({ ...o, [p.kind]: !o[p.kind] }))} highlight={demo === 4 && p.kind === "compromise"} />
                    </ErrorBoundary>
                  </div>
                ))}
                <Card icon={Table2} title={t.compareTitle} explain={ar ? "كل الأرقام للمزرعة كلها في 3 سنين." : "All numbers for the whole farm over 3 years."} className="col-span-12">
                  <ComparisonTable plans={plans} />
                </Card>
              </>
            ) : (
              <>
                <div className="col-span-12"><Shimmer height={58} /></div>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="col-span-12 md:col-span-6"><Shimmer height={420} /></div>
                ))}
              </>
            )}
          </>
        );
      case "whatif":
        return plans && meta.data ? (
          <>
            <div className="col-span-12">
              <ErrorBoundary>
                <WhatIf plans={plans} meta={meta.data} state={wi} onChange={setWi} />
              </ErrorBoundary>
            </div>
            <Card icon={Waves} title={ar ? "اختبار التحمّل" : "Stress test"} explain={c.s4Lead} className="col-span-12">
              <StressViz plans={plans} />
            </Card>
          </>
        ) : (
          <>
            <CardSkeleton icon={SlidersHorizontal} title={c.labTitle} height={380} className="col-span-12" />
            <CardSkeleton icon={Waves} title={ar ? "اختبار التحمّل" : "Stress test"} height={300} className="col-span-12" />
          </>
        );
      case "evidence":
        return (
          <>
            {map.data ? <SatelliteStep map={map.data} evidence={evidence.data} playing={playing} onPlaying={setPlaying} /> : <EvidenceSkeleton />}
            <Card icon={Gauge} title={ar ? "التوأم الرقمي للتربة" : "Soil digital twin"} explain={ar ? "الملح والكربون والنيتروجين موسم ورا موسم." : "Salt, carbon and nitrogen, season by season."} className="col-span-12 lg:col-span-6" id="ev-twin">
              {plans ? <SoilTwin plans={plans} /> : <Shimmer height={300} />}
            </Card>
            <Card icon={Brain} title={ar ? "الذكاء الاصطناعي بيدوّر" : "AI search of rotations"} explain={ar ? "آلاف الدورات اتجربت؛ الخضرا هي أحسن موازنة." : "Thousands of rotations tried; green = best trade-offs."} className="col-span-12 lg:col-span-6" id="ev-search">
              {config.data && plans ? <SearchViz file={config.data} plans={plans} /> : <Shimmer height={300} />}
            </Card>
          </>
        );
      case "nasa":
        return (
          <>
            <Card icon={Database} title={ar ? "بيانات ناسا المستخدمة" : "NASA datasets used"} explain={ar ? "اقلب أي كارت عشان تعرف بيغذّي إيه في الموديل." : "Flip any card to see what it feeds in the model."} className="col-span-12">
              <DatasetGrid evidence={evidence.data} />
            </Card>
            <div className="col-span-12"><EoTiles evidence={evidence.data} /></div>
            <div className="col-span-12">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><CloudSun size={20} className="text-brand" aria-hidden />{t.snapshot}</h3>
              <ErrorBoundary>{climate.data ? <ClimateSnapshot c={climate.data} eo={evidence.data?.eo} /> : <Shimmer height={600} />}</ErrorBoundary>
            </div>
            <Card icon={BookOpen} title={t.glossaryTitle} explain={ar ? "الكلمات الصعبة بكلام بسيط." : "The hard words, in plain language."} className="col-span-12 lg:col-span-6">
              <details className="group">
                <summary className="btn-ghost cursor-pointer list-none">{ar ? "اعرف أكتر" : "Learn more"}</summary>
                <div className="mt-4"><Glossary /></div>
              </details>
            </Card>
            <Card icon={Library} title={ar ? "المصادر" : "Sources"} explain={ar ? "كل رقم ليه مصدر (S1–S18) أو افتراض مكتوب." : "Every number has a source (S1–S18) or a documented assumption."} className="col-span-12 lg:col-span-6">
              <details>
                <summary className="btn-ghost cursor-pointer list-none">{ar ? "اعرف أكتر" : "Learn more"}</summary>
                <SourceList meta={meta.data} />
              </details>
            </Card>
          </>
        );
    }
  })();

  const meta4 = TABS.find((x) => x.id === tab)!;
  const leads: Record<TabId, string> = {
    farm: t.farmLead,
    plans: c.plansLead,
    whatif: c.labLead,
    evidence: ar ? "اللي الأقمار شافته في رأس سدر، والتربة، وإزاي الذكاء الاصطناعي اختار." : "What satellites saw in Ras Sudr, the soil twin, and how the AI chose.",
    nasa: ar ? "كل مصادر ناسا والبيانات المحلية ورا الأرقام." : "Every NASA dataset and local source behind the numbers.",
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1200px] px-4 pb-8">
        <Hero data={hero} onExplore={() => go("plans")} />
        <div id="app-top" />
        <TabNav tab={tab} onChange={(x) => go(x)} lang={lang} />
        <div className="relative overflow-x-clip pt-6">
          <div
            key={tab}
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
            tabIndex={-1}
            className={`panel-in ${dirn > 0 ? "panel-next" : "panel-prev"} outline-none`}
          >
            <div className="mb-5 flex items-start gap-3">
              <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-paper" aria-hidden>
                <meta4.icon size={18} />
              </span>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{ar ? meta4.ar : meta4.en}</h2>
                <p className="mt-1 max-w-[70ch] text-muted">{leads[tab]}</p>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-4 sm:gap-6">{panel}</div>
            {tab !== "nasa" && (
              <div className="mt-8 flex justify-end">
                <button className="btn-ghost" onClick={() => go(TABS[TABS.findIndex((x) => x.id === tab) + 1].id)}>
                  {ar ? "اللي بعده: " : "Next: "}
                  {ar ? TABS[TABS.findIndex((x) => x.id === tab) + 1].ar : TABS[TABS.findIndex((x) => x.id === tab) + 1].en}
                  <ArrowRight size={16} className="rtl:rotate-180" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />

      {demo !== null && (
        <div className="fixed inset-x-0 bottom-20 z-[2000] flex justify-center px-4 sm:bottom-4" role="status" aria-live="polite">
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
