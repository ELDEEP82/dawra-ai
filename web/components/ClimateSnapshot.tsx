"use client";
/** NASA snapshot: annual rain vs ET0, monthly temperatures vs S1, monthly water balance, soil wetness, heat days, NDVI status. */
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Climate } from "@/lib/types";
import { fmt, useLang } from "@/lib/i18n";
import { SERIES } from "@/lib/crops";

const AX = { stroke: "#64748b", fontSize: 11 };
const GRID = <CartesianGrid stroke="#ffffff" strokeOpacity={0.06} vertical={false} />;
const TIP = { contentStyle: { background: "#0a1024", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, fontSize: 12 }, labelStyle: { color: "#e6e9f2" } };
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      <div className="mt-3 h-52" dir="ltr">
        {children}
      </div>
    </div>
  );
}

export function KeyNumbers({ c, salineShare }: { c: Climate; salineShare: [number, number] | null }) {
  const { t } = useLang();
  const ratio = c.summary.et0_mm / c.summary.rain_mm;
  const items = [
    { k: t.et0, v: `${fmt(c.summary.et0_mm)} mm`, s: t.perYear },
    { k: t.rain, v: `${fmt(c.summary.rain_mm)} mm`, s: `${t.perYear} · ET0 ≈ ${fmt(ratio)}×` },
    { k: t.heatDays, v: fmt(c.summary.heat_days), s: c.summary.years },
    ...(salineShare ? [{ k: t.saline, v: `${fmt(salineShare[0] * 100)}% → ${fmt(salineShare[1] * 100)}%`, s: "1996 → 2022 (S16)" }] : []),
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <div key={it.k} className="card p-4">
          <div className="text-xs text-slate-400">{it.k}</div>
          <div className="kpi mt-1">{it.v}</div>
          <div className="text-xs text-slate-500">{it.s}</div>
        </div>
      ))}
    </div>
  );
}

export function ClimateSnapshot({ c, eoStatus }: { c: Climate; eoStatus: string }) {
  const { t, lang } = useLang();
  const months = lang === "ar" ? MONTHS_AR : MONTHS_EN;
  const monthly = c.monthly.map((m) => ({ ...m, name: months[m.month - 1] }));
  const rainLbl = lang === "ar" ? "المطر" : "Rain";
  const et0Lbl = "ET0";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard title={t.annualChart} note="NASA POWER · FAO-56 Penman–Monteith">
        <ResponsiveContainer>
          <ComposedChart data={c.annual} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            {GRID}
            <XAxis dataKey="year" {...AX} tickLine={false} interval={7} />
            <YAxis {...AX} tickLine={false} axisLine={false} unit="" />
            <Tooltip {...TIP} formatter={(v: unknown) => `${fmt(Number(v))} mm`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar isAnimationActive={false} dataKey="rain" name={`${rainLbl} (mm)`} fill={SERIES.rain} radius={[3, 3, 0, 0]} />
            <Line isAnimationActive={false} dataKey="et0" name={`${et0Lbl} (mm)`} stroke={SERIES.et0} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.monthlyChart} note={lang === "ar" ? "الخطوط: ناسا 1991–2020 · النقط: S1 (1983–2020)" : "Lines: NASA 1991–2020 · dots: S1 table (1983–2020)"}>
        <ResponsiveContainer>
          <ComposedChart data={monthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            {GRID}
            <XAxis dataKey="name" {...AX} tickLine={false} />
            <YAxis {...AX} tickLine={false} axisLine={false} unit="°" />
            <Tooltip {...TIP} formatter={(v: unknown) => `${fmt(Number(v), 1)} °C`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line isAnimationActive={false} dataKey="tmax" name="Tmax" stroke={SERIES.tmax} strokeWidth={2} dot={false} />
            <Line isAnimationActive={false} dataKey="tmin" name="Tmin" stroke={SERIES.tmin} strokeWidth={2} dot={false} />
            <Scatter isAnimationActive={false} dataKey="s1_tmax" name="S1 Tmax" fill={SERIES.tmax} shape="circle" />
            <Scatter isAnimationActive={false} dataKey="s1_tmin" name="S1 Tmin" fill={SERIES.tmin} shape="circle" />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.monthlyWater} note="NASA POWER 1991–2020">
        <ResponsiveContainer>
          <BarChart data={monthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={2}>
            {GRID}
            <XAxis dataKey="name" {...AX} tickLine={false} />
            <YAxis {...AX} tickLine={false} axisLine={false} />
            <Tooltip {...TIP} formatter={(v: unknown) => `${fmt(Number(v), 1)} mm`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar isAnimationActive={false} dataKey="rain" name={`${rainLbl} (mm)`} fill={SERIES.rain} radius={[3, 3, 0, 0]} />
            <Bar isAnimationActive={false} dataKey="et0" name={`${et0Lbl} (mm)`} fill={SERIES.et0} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.soilMoisture} note={lang === "ar" ? "0 = جاف تمامًا · 1 = مشبع" : "0 = bone dry · 1 = saturated · interim until SMAP"}>
        <ResponsiveContainer>
          <LineChart data={monthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            {GRID}
            <XAxis dataKey="name" {...AX} tickLine={false} />
            <YAxis {...AX} tickLine={false} axisLine={false} domain={[0, 0.5]} />
            <Tooltip {...TIP} formatter={(v: unknown) => fmt(Number(v), 3)} />
            <Line isAnimationActive={false} dataKey="gwet" name="GWETROOT" stroke={SERIES.soil} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t.heatDays} note="NASA POWER T2M_MAX > 35 °C">
        <ResponsiveContainer>
          <BarChart data={c.annual} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            {GRID}
            <XAxis dataKey="year" {...AX} tickLine={false} interval={7} />
            <YAxis {...AX} tickLine={false} axisLine={false} />
            <Tooltip {...TIP} formatter={(v: unknown) => `${fmt(Number(v))} ${lang === "ar" ? "يوم" : "days"}`} />
            <Bar isAnimationActive={false} dataKey="heat_days" name={t.heatDays} fill={SERIES.et0} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="card flex flex-col p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-slate-200">{t.ndviTitle}</h3>
          {eoStatus !== "ok" && (
            <span className="rounded-full border border-nasa-amber/50 px-2 py-0.5 text-[11px] text-nasa-amber">{t.pending}</span>
          )}
        </div>
        <p className="mt-3 text-sm text-slate-400">{t.ndviPending}</p>
        <ul className="mt-3 space-y-1 text-xs text-slate-500" dir="ltr">
          <li>• Sentinel-2 SR (10 m) · Landsat 5/7/8/9 (30 m)</li>
          <li>• SMAP L4 · GPM IMERG V07 · MODIS LST/ET</li>
          <li>• SRTM · GRACE-FO · NEX-GDDP-CMIP6</li>
        </ul>
        <div className="mt-auto pt-3 text-xs text-slate-500">engine/dawra/eo.py · earthengine authenticate → make data</div>
      </div>
    </div>
  );
}
