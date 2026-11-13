"use client";
/** Compact hero that fits 1280×720: two-line headline, one-line subtitle, three flip stat cards with server-rendered
 *  values, two CTAs and an Earth poster (instant) that cross-fades to the 3D globe only once its texture has drawn. */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, RotateCw, Tractor } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { onFirstInteraction } from "@/lib/data";
import { COPY } from "@/lib/copy";
import { Counter, CssFlip } from "./lite";
import { POSTER_LQIP } from "@/lib/posterLqip";

const Globe = dynamic(() => import("./Globe"), { ssr: false });

/** Hero numbers computed on the server from public/data (see app/[lang]/page.tsx). */
export interface HeroData {
  rainPct: number;
  rainMm: number;
  et0Mm: number;
  ecw: number;
  green2022: number;
  green1996: number;
}

function StatCard({ value, label, back, tone }: { value: React.ReactNode; label: string; back: string; tone: string }) {
  return (
    <CssFlip
      label={label}
      className="h-[112px]"
      front={
        <div className="card relative flex h-full flex-col justify-between p-3.5">
          <div className={`text-[26px] font-semibold leading-none tracking-tight ${tone}`}>{value}</div>
          <div className="text-xs leading-snug text-muted">{label}</div>
          <RotateCw aria-hidden size={12} className="absolute end-3 top-3 text-slate-600" />
        </div>
      }
      back={<div className="card flex h-full items-center p-3.5 text-[11.5px] leading-snug text-slate-300">{back}</div>}
    />
  );
}

/** Poster first; the WebGL globe mounts on the first interaction (≥640px, motion allowed, WebGL available) and only
 *  becomes visible after its first textured frame. If that takes more than 2 s or WebGL fails, the poster stays. */
function EarthVisual({ ar }: { ar: boolean }) {
  const [mount, setMount] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) setLoaded(true);
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !window.matchMedia("(min-width: 640px)").matches) return;
    // Boot WebGL on the first interaction (desktop visitors move the pointer at once), so it never blocks first load.
    return onFirstInteraction(() => {
      try {
        const c = document.createElement("canvas");
        if (c.getContext("webgl2") || c.getContext("webgl")) setMount(true);
      } catch {
        /* no WebGL → keep the poster */
      }
    });
  }, []);
  useEffect(() => {
    if (!mount || ready) return;
    const t = window.setTimeout(() => setMount(false), 2000); // too slow → keep the poster
    return () => window.clearTimeout(t);
  }, [mount, ready]);
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setZoom(0.6), 1600);
    return () => window.clearTimeout(t);
  }, [ready]);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[150px] sm:max-w-[280px] lg:max-w-[360px]">
      <div aria-hidden className="absolute inset-[-10%] rounded-full bg-[radial-gradient(circle,rgba(43,182,115,.16),transparent_62%)]" />
      <div className="relative h-full w-full overflow-hidden rounded-full bg-cover" style={loaded ? undefined : { backgroundImage: `url(${POSTER_LQIP})` }} data-testid="globe" role="img" aria-label={ar ? "الكرة الأرضية وعليها رأس سدر في مصر" : "Earth from space with Ras Sudr, Egypt marked"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={img}
          onLoad={() => setLoaded(true)}
          src="/textures/earth_poster.webp"
          srcSet="/textures/earth_poster.webp 480w, /textures/earth_poster@2x.webp 960w"
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 280px, 150px"
          alt=""
          width={480}
          height={480}
          fetchPriority="high"
          decoding="async"
          data-testid="globe-poster"
          className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
        />
        {mount && (
          <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} data-testid="globe-canvas">
            <Globe target={{ lat: 29.6, lon: 32.7 }} zoom={zoom} className="aspect-square w-full" onReady={onReady} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Hero({ data, onExplore }: { data: HeroData; onExplore: () => void }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const ar = lang === "ar";
  const rain = Math.round(data.rainMm), et0 = Math.round(data.et0Mm).toLocaleString("en-US");
  const backs = ar
    ? [
        `المطر ${rain} مم/سنة قصاد احتياج الزرع ${et0} مم/سنة (ناسا POWER 1981–2025، FAO-56).`,
        "ملوحة بير المزرعة F001 (S1). آبار رأس سدر من 3 لـ 38 dS/m؛ المية العالية الملوحة زادت من 52٪ لـ 83٪ (S16).",
        `المساحة الخضرا في سهل رأس سدر سنة 2022 (مسح S16)؛ كانت ${Math.round(data.green1996)} هكتار في 1996.`,
      ]
    : [
        `Rain ${rain} mm/yr vs crop water need ${et0} mm/yr (NASA POWER 1981–2025, FAO-56).`,
        "Well salinity of farm F001 (S1). Ras Sudr wells range 3–38 dS/m; highly-saline aquifer share 52 % → 83 % (S16).",
        `Green area of the Ras Sudr plain in 2022 (S16 survey); it was ${Math.round(data.green1996)} ha in 1996.`,
      ];
  return (
    <section id="hero" className="relative py-6 sm:py-10" aria-label="Dawra AI">
      <div className="grid items-center gap-6 lg:grid-cols-[1.45fr_1fr] lg:gap-10">
        <div className="relative z-10 order-2 lg:order-1">
          <p className="fade-up inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-leaf" aria-hidden />
            {c.heroKicker}
          </p>
          <h1 className="fade-up mt-4 max-w-[18ch] text-[clamp(36px,4.3vw,56px)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink rtl:max-w-[20ch] rtl:leading-[1.3] rtl:tracking-normal">
            {c.heroTitle}
          </h1>
          <p className="fade-up mt-3 max-w-[62ch] text-base text-slate-300 sm:text-[17px]" style={{ animationDelay: "120ms" }}>
            {c.heroProblem}
          </p>
          <div className="mt-5 grid max-w-[600px] grid-cols-3 gap-2.5 sm:gap-3" data-testid="hero-stats">
            <StatCard tone="text-brand-sky" value={<Counter value={data.rainPct} nd={1} suffix="%" />} label={c.cRain} back={backs[0]} />
            <StatCard tone="text-sand-ink" value={<Counter value={data.ecw} nd={2} />} label={c.cWell} back={backs[1]} />
            <StatCard tone="text-brand" value={<Counter value={data.green2022} />} label={c.cGreen} back={backs[2]} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href="#plans"
              onClick={(e) => {
                e.preventDefault();
                onExplore();
              }}
              className="btn-primary"
            >
              {c.ctaExplore} <ArrowDown size={16} aria-hidden />
            </a>
            <Link prefetch={false} href="/ar/farmer" className="btn-ghost">
              <Tractor size={16} aria-hidden /> {c.ctaFarmer}
            </Link>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <EarthVisual ar={ar} />
        </div>
      </div>
    </section>
  );
}
