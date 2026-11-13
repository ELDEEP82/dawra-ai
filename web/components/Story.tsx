"use client";
/** "From space to the field" scroll story: satellite map + time slider, soil twin, AI search, stress test. */
import dynamic from "next/dynamic";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, ResponsiveContainer, Scatter, ComposedChart, Tooltip, XAxis, YAxis } from "recharts";
import type { ConfigFile, Evidence, MapData, Plan } from "@/lib/types";
import { fmt, useLang } from "@/lib/i18n";
import { COPY } from "@/lib/copy";
import { PLAN_COLORS, cropStyle } from "@/lib/crops";
import { Ring, Skeleton, Tabs } from "./ui";
import type { Basemap, MapLayer } from "./MapPanel";
import { PATTERN_COLOR, patternLabel } from "./MapPanel";

const MapPanel = dynamic(() => import("./MapPanel"), { ssr: false, loading: () => <Skeleton className="h-[420px] sm:h-[520px]" /> });
const TIP = { contentStyle: { background: "#FFFFFF", border: "1px solid #E8E8E3", color: "#14201B", borderRadius: 10, fontSize: 12 } };

// ------------------------------------------------------------------------------------------------ 1 · satellites
export function SatelliteStep({ map, evidence, playing, onPlaying }: { map: MapData; evidence: Evidence | null; playing: boolean; onPlaying: (p: boolean) => void }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const anim = !useReducedMotion();
  const years = useMemo(() => Object.keys(map.overlays?.ndvi ?? {}).map(Number).sort(), [map]);
  const [layer, setLayer] = useState<MapLayer>("ndvi");
  const [basemap, setBasemap] = useState<Basemap>("light");
  const [year, setYear] = useState<number>(years[years.length - 1] ?? 2025);
  useEffect(() => {
    if (!playing || years.length === 0) return;
    setLayer("ndvi");
    let i = years[0] === year ? 0 : years.indexOf(year) >= years.length - 1 ? 0 : years.indexOf(year);
    const id = setInterval(() => {
      i += 1;
      if (i >= years.length) {
        clearInterval(id);
        onPlaying(false);
        return;
      }
      setYear(years[i]);
    }, 260);
    if (i === 0) setYear(years[0]);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, years]);
  const veg = evidence?.eo.veg_area ?? [];
  const chart = veg.map((v) => ({ year: v.year, ha: Math.round(v["ha_ndvi_gt_0.25"] ?? 0), s16: v.year === 1996 ? 57 : v.year === 2022 ? 1579 : null }));
  const cur = chart.find((d) => d.year === year);
  const fields = evidence?.eo.fields;
  const layers: [MapLayer, string][] = [["ndvi", c.lNdvi], ["lst", c.lLst], ["rain", c.lRain], ["slope", c.lSlope], ["none", c.lNone]];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs id="layer" label={c.layer} value={layer} onChange={setLayer} items={layers.map(([k, l]) => ({ key: k, label: l }))} />
          <Tabs id="base" label="Basemap" value={basemap} onChange={setBasemap} items={[{ key: "light", label: lang === "ar" ? "خريطة" : "Map" }, { key: "satellite", label: lang === "ar" ? "قمر صناعي" : "Satellite" }]} />
        </div>
        <MapPanel data={map} layer={layer} year={year} basemap={basemap} />
        <div className="flex items-center gap-3" dir="ltr">
          <button onClick={() => onPlaying(!playing)} className="rounded-full bg-brand px-4 py-1.5 min-h-[44px] text-sm font-semibold text-paper" aria-label={playing ? c.pause : c.play}>
            {playing ? "❚❚" : "▶"} {playing ? c.pause : c.play}
          </button>
          <input type="range" min={years[0]} max={years[years.length - 1]} value={year} onChange={(e) => { setLayer("ndvi"); setYear(Number(e.target.value)); }} className="flex-1" aria-label={c.year} />
          <span className="w-12 text-end text-lg font-semibold tabular-nums">{year}</span>
        </div>
      </div>
      <div className="space-y-3">
        <div className="card p-4">
          <div className="text-xs text-slate-400">{c.greenArea}</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums" dir="ltr">{fmt(cur?.ha ?? 0)} ha <span className="text-base font-normal text-slate-400">· {year}</span></div>
          <div className="mt-2 h-40" dir="ltr">
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 4, right: 18, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#14201B" strokeOpacity={0.07} vertical={false} />
                <XAxis dataKey="year" stroke="#5E6B66" fontSize={10} tickLine={false} interval={6} />
                <YAxis stroke="#5E6B66" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip {...TIP} formatter={(v: unknown, n: unknown) => [`${fmt(Number(v))} ha`, String(n)]} />
                <Line isAnimationActive={anim} animationDuration={900} dataKey="ha" name="Landsat" stroke="#2BB673" strokeWidth={2} dot={false} />
                <Scatter isAnimationActive={anim} animationDuration={900} dataKey="s16" name={c.s16} fill="#E8A23A" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400" dir="ltr">
            <span><span className="me-1 inline-block h-0.5 w-4 bg-nasa-green align-middle" />Landsat</span>
            <span><span className="me-1 inline-block h-2 w-2 rounded-full bg-nasa-amber align-middle" />S16 (1996, 2022)</span>
          </div>
        </div>
        {fields && (
          <div className="card p-4">
            <div className="text-2xl font-semibold tabular-nums" dir="ltr">{fields.n_fields} <span className="text-sm font-normal text-slate-400">· {fmt(fields.area_ha)} ha</span></div>
            <div className="text-xs text-slate-400">{c.fields}</div>
            <div className="mt-3 text-xs text-slate-400">{c.fieldPattern}</div>
            <ul className="mt-1 space-y-1 text-sm">
              {Object.entries(fields.rotation_guess_counts).slice(0, 4).map(([k, v]) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PATTERN_COLOR[k] ?? "#f9c74f" }} />
                  <span className="flex-1">{patternLabel(k, lang)}</span>
                  <span className="tabular-nums text-slate-300">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 2 · soil twin
function Gauge({ label, value, min, max, nd, unit, goodDown }: { label: string; value: number; min: number; max: number; nd: number; unit: string; goodDown?: boolean }) {
  const f = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const ang = -120 + f * 240;
  const color = goodDown ? (f > 0.66 ? "#E5533D" : f > 0.4 ? "#E8A23A" : "#2BB673") : f > 0.5 ? "#2BB673" : "#E8A23A";
  return (
    <div className="card flex flex-col items-center p-4">
      <svg viewBox="-60 -60 120 90" className="w-40" role="img" aria-label={`${label}: ${value.toFixed(nd)} ${unit}`}>
        <path d="M -48 28 A 52 52 0 1 1 48 28" stroke="rgba(20,32,27,.08)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <motion.g animate={{ rotate: ang }} transition={{ type: "spring", stiffness: 60, damping: 14 }}>
          <line x1="0" y1="0" x2="0" y2="-44" stroke={color} strokeWidth="4" strokeLinecap="round" />
        </motion.g>
        <circle r="5" fill={color} />
      </svg>
      <div className="-mt-2 text-2xl font-semibold tabular-nums" dir="ltr">{value.toFixed(nd)} <span className="text-sm font-normal text-slate-400">{unit}</span></div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

export function SoilTwin({ plans }: { plans: Plan[] }) {
  const { lang, t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [kind, setKind] = useState(plans.find((p) => p.kind === "compromise") ? "compromise" : plans[0].kind);
  const plan = plans.find((p) => p.kind === kind) ?? plans[0];
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setStep((s) => (s + 1) % 7), 1300);
    return () => clearInterval(id);
  }, [inView, reduce]);
  const st = plan.soil_trajectory[reduce ? 6 : step];
  const season = step > 0 ? plan.seasons[step - 1] : null;
  return (
    <div ref={ref} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {plans.filter((p, i, a) => a.findIndex((q) => q.view.sig === p.view.sig) === i).map((p) => (
          <button key={p.kind} onClick={() => setKind(p.kind)} className={`chip text-xs ${p.kind === kind ? "chip-on" : "hover:bg-white/5"}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[p.kind] }} />
            {lang === "ar" ? p.view.label_ar : p.view.label_en}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1" dir="ltr">
        {plan.soil_trajectory.map((s, i) => {
          const se = i > 0 ? plan.seasons[i - 1] : null;
          return (
            <button key={s.t} onClick={() => setStep(i)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs transition ${i === step ? "border-nasa-cyan bg-nasa-cyan/15" : "border-white/10"}`}>
              <div className="text-slate-400">{i === 0 ? (lang === "ar" ? "البداية" : "start") : s.t}</div>
              <div>{se ? `${cropStyle(se.crop_id).icon} ${lang === "ar" ? se.crop_ar : se.crop_en.replace(/ \(.+\)/, "")}` : "🧪"}</div>
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Gauge label={t.ece} value={st.ece} min={4} max={11} nd={2} unit="dS/m" goodDown />
        <Gauge label={t.soc} value={st.soc} min={0.15} max={0.21} nd={3} unit="%" />
        <Gauge label={t.nitrogen} value={st.n} min={15} max={40} nd={1} unit="mg/kg" />
      </div>
      {season && (
        <p className="text-sm text-slate-400">
          {season.slot}: {lang === "ar" ? season.crop_ar : season.crop_en}
          {season.crop_id !== "fallow" && season.lr_pct !== undefined && (lang === "ar" ? ` · مية غسيل ${season.lr_pct}٪ · ${season.area_fdn} فدان` : ` · leaching ${season.lr_pct}% · ${season.area_fdn} feddan`)}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 3 · AI search
export function SearchViz({ file, plans }: { file: ConfigFile; plans: Plan[] }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const n = file.explored.length;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduce) {
      setShown(n);
      return;
    }
    if (!inView) return;
    let k = 0;
    const id = setInterval(() => {
      k += Math.ceil(n / 60);
      setShown(Math.min(n, k));
      if (k >= n) clearInterval(id);
    }, 40);
    return () => clearInterval(id);
  }, [inView, reduce, n]);
  const all = [...file.explored.map(([w, v]) => [w, v]), ...file.front.map(([w, v]) => [w, v])];
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const W = 600, H = 320, P = 36;
  const sx = (x: number) => P + ((x - x0) / Math.max(x1 - x0, 1)) * (W - 2 * P);
  const sy = (y: number) => H - P - ((y - y0) / Math.max(y1 - y0, 1)) * (H - 2 * P);
  const done = shown >= n;
  return (
    <div ref={ref} className="card p-4">
      <div className="flex flex-wrap gap-6 text-sm" dir="ltr">
        <span><b className="text-2xl tabular-nums">{fmt(Math.round((shown / Math.max(n, 1)) * file.evaluated))}</b> {c.explored}</span>
        <span><b className="text-2xl tabular-nums">{done ? file.front_size : 0}</b> {c.front}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Optimiser search: water vs profit" direction="ltr">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#D9D9D2" />
        <line x1={P} y1={P} x2={P} y2={H - P} stroke="#D9D9D2" />
        <text x={W / 2} y={H - 8} fill="#5E6B66" fontSize="11" textAnchor="middle">{lang === "ar" ? "المية في 3 سنين (م³) ←" : "water, 3 years (m³) →"}</text>
        <text x={12} y={H / 2} fill="#5E6B66" fontSize="11" transform={`rotate(-90 12 ${H / 2})`} textAnchor="middle">{lang === "ar" ? "الربح (جنيه)" : "profit (EGP)"}</text>
        {file.explored.slice(0, shown).map(([w, v], i) => (
          <circle key={i} cx={sx(w)} cy={sy(v)} r={2.2} fill="#5E6B66" opacity={0.45} />
        ))}
        {done && file.front.map(([w, v], i) => (
          <motion.circle key={`f${i}`} cx={sx(w)} cy={sy(v)} r={3.2} fill="#2BB673" initial={{ opacity: 0 }} animate={{ opacity: 0.9 }} transition={{ delay: i * 0.004 }} />
        ))}
        {done && plans.filter((p, i, a) => a.findIndex((q) => q.view.sig === p.view.sig) === i).map((p, i) => (
          <motion.g key={p.kind} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 + i * 0.25 }} style={{ transformOrigin: `${sx(p.totals.water_m3)}px ${sy(p.totals.value)}px` }}>
            <circle cx={sx(p.totals.water_m3)} cy={sy(p.totals.value)} r={8} fill={PLAN_COLORS[p.kind]} stroke="#FFFFFF" strokeWidth={2} />
            <text x={sx(p.totals.water_m3) + (sx(p.totals.water_m3) > W * 0.7 ? -11 : 11)} y={sy(p.totals.value) + 4} fill="#14201B" fontSize="11" textAnchor={sx(p.totals.water_m3) > W * 0.7 ? "end" : "start"}>{lang === "ar" ? p.view.label_ar : p.view.label_en}</text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 4 · stress test
export function StressViz({ plans }: { plans: Plan[] }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const uniq = plans.filter((p, i, a) => a.findIndex((q) => q.view.sig === p.view.sig) === i);
  const [kind, setKind] = useState(uniq[0].kind);
  const [lv, setLv] = useState<"100" | "70">("70");
  const plan = uniq.find((p) => p.kind === kind) ?? uniq[0];
  const paths = plan.robustness.paths?.[lv];
  const W = 600, H = 260, P = 30;
  const allV = uniq.flatMap((p) => Object.values(p.robustness.paths ?? {}).flatMap((x) => x.ece.flat()));
  const v0 = Math.min(...allV, 8.56) - 0.3, v1 = Math.max(...allV, 8.56) + 0.3;
  const sx = (i: number) => P + (i / 6) * (W - 2 * P);
  const sy = (v: number) => H - P - ((v - v0) / (v1 - v0)) * (H - 2 * P);
  const fails = paths ? paths.pass.filter((x) => !x).length : 0;
  return (
    <div ref={ref} className="grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {uniq.map((p) => (
            <button key={p.kind} onClick={() => setKind(p.kind)} className={`chip text-xs ${p.kind === kind ? "chip-on" : "hover:bg-white/5"}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[p.kind] }} />
              {lang === "ar" ? p.view.label_ar : p.view.label_en}
            </button>
          ))}
          <span className="mx-1 w-px bg-white/10" />
          {(["100", "70"] as const).map((k) => (
            <button key={k} onClick={() => setLv(k)} className={`chip text-xs ${lv === k ? "chip-on" : "hover:bg-white/5"}`}>
              {k === "100" ? c.leachFull : c.leach70}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Soil salinity in 40 simulated futures" direction="ltr">
          <line x1={P} y1={sy(8.56)} x2={W - P} y2={sy(8.56)} stroke="#E8A23A" strokeDasharray="4 4" opacity={0.9} />
          <text x={W - P} y={sy(8.56) - 4} fill="#8A5A0B" fontSize="10" textAnchor="end">ECe start 8.56</text>
          {["start", "W1", "S1", "W2", "S2", "W3", "S3"].map((l, i) => (
            <text key={l} x={sx(i)} y={H - 8} fill="#5E6B66" fontSize="10" textAnchor="middle">{l}</text>
          ))}
          {inView && paths?.ece.map((row, i) => (
            <motion.path
              key={`${kind}-${lv}-${i}`}
              d={row.map((v, j) => `${j ? "L" : "M"}${sx(j).toFixed(1)},${sy(v).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={paths.pass[i] ? "#2D8CFF" : "#E5533D"}
              strokeWidth={1.2}
              strokeOpacity={paths.pass[i] ? 0.4 : 0.55}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.2, delay: i * 0.02 }}
            />
          ))}
        </svg>
        <div className="mt-1 flex gap-4 text-xs text-slate-400" dir="ltr">
          <span><span className="me-1 inline-block h-0.5 w-4 align-middle" style={{ background: "#2D8CFF" }} />{c.ok}</span>
          <span><span className="me-1 inline-block h-0.5 w-4 align-middle" style={{ background: "#E5533D" }} />{c.failed} ({fails}/40)</span>
        </div>
      </div>
      <div className="card flex flex-col items-center justify-center gap-3 p-4 text-center">
        <Ring pct={plan.robustness.robustness_pct} size={120} label="robustness" />
        <div className="text-sm text-slate-300" dir="ltr">{fmt(plan.robustness.n_draws)} {c.futures}</div>
        <ul className="w-full space-y-1 text-start text-xs text-slate-400">
          {plan.robustness.by_leaching.map((b) => (
            <li key={b.leach_pct} className="flex justify-between" dir="ltr"><span>{b.leach_pct}% leaching</span><span>{fmt(b.pass_pct)}%</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
