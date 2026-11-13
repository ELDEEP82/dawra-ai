"use client";
/** NASA snapshot: annual rain vs ET0, monthly temperatures vs S1, monthly water balance, soil wetness, heat days, NDVI status. */
import {
  Area,
  AreaChart,
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
import type { Climate, EOData } from "@/lib/types";
import { fmt, useLang } from "@/lib/i18n";
import { SERIES } from "@/lib/crops";
import { useReducedMotion } from "framer-motion";

const AX = { stroke: "#5E6B66", fontSize: 11 };
const GRID = <CartesianGrid stroke="#14201B" strokeOpacity={0.07} vertical={false} />;
const TIP = { contentStyle: { background: "#FFFFFF", border: "1px solid #E8E8E3", color: "#14201B", borderRadius: 10, fontSize: 12 }, labelStyle: { color: "#14201B", fontWeight: 600 } };
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
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

export function ClimateSnapshot({ c, eo }: { c: Climate; eo?: EOData | null }) {
  const { t, lang } = useLang();
  const anim = !useReducedMotion();
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
            <Bar isAnimationActive={anim} animationDuration={900} dataKey="rain" name={`${rainLbl} (mm)`} fill={SERIES.rain} radius={[6, 6, 0, 0]} />
            <defs>
              <linearGradient id="gEt0" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.et0} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES.et0} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area isAnimationActive={anim} animationDuration={900} type="monotone" dataKey="et0" name={`${et0Lbl} (mm)`} stroke={SERIES.et0} strokeWidth={2.5} fill="url(#gEt0)" />
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
            <Line isAnimationActive={anim} animationDuration={900} dataKey="tmax" name="Tmax" stroke={SERIES.tmax} strokeWidth={2} dot={false} />
            <Line isAnimationActive={anim} animationDuration={900} dataKey="tmin" name="Tmin" stroke={SERIES.tmin} strokeWidth={2} dot={false} />
            <Scatter isAnimationActive={anim} animationDuration={900} dataKey="s1_tmax" name="S1 Tmax" fill={SERIES.tmax} shape="circle" />
            <Scatter isAnimationActive={anim} animationDuration={900} dataKey="s1_tmin" name="S1 Tmin" fill={SERIES.tmin} shape="circle" />
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
            <Bar isAnimationActive={anim} animationDuration={900} dataKey="rain" name={`${rainLbl} (mm)`} fill={SERIES.rain} radius={[6, 6, 0, 0]} />
            <Bar isAnimationActive={anim} animationDuration={900} dataKey="et0" name={`${et0Lbl} (mm)`} fill={SERIES.et0} radius={[6, 6, 0, 0]} />
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
            <Line isAnimationActive={anim} animationDuration={900} dataKey="gwet" name="GWETROOT" stroke={SERIES.soil} strokeWidth={2} dot={{ r: 4 }} />
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
            <Bar isAnimationActive={anim} animationDuration={900} dataKey="heat_days" name={t.heatDays} fill={SERIES.et0} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {eo?.ndvi_station ? (
        <ChartCard title={lang === "ar" ? "خضرة المحطة (NDVI شهري، لاندسات + Sentinel-2)" : "Station greenness (monthly NDVI, Landsat + Sentinel-2)"} note="1990–2026">
          <ResponsiveContainer>
            <AreaChart data={eo.ndvi_station.map(([d, v]) => ({ d, v }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gNdvi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.soil} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SERIES.soil} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {GRID}
              <XAxis dataKey="d" {...AX} tickLine={false} interval={60} />
              <YAxis {...AX} tickLine={false} axisLine={false} domain={[0, "auto"]} />
              <Tooltip {...TIP} formatter={(v: unknown) => fmt(Number(v), 3)} />
              <Area isAnimationActive={anim} animationDuration={900} type="monotone" dataKey="v" name="NDVI" stroke={SERIES.soil} strokeWidth={1.5} fill="url(#gNdvi)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <div className="card p-4 text-sm text-slate-400">{t.ndviPending}</div>
      )}
      {eo?.smap_rootzone && (
        <ChartCard title={lang === "ar" ? "رطوبة التربة من SMAP L4 (م³/م³)" : "SMAP L4 soil moisture (m³/m³)"} note={lang === "ar" ? "منطقة الجذور والسطح، 2015–2026" : "root zone & surface, 2015–2026"}>
          <ResponsiveContainer>
            <LineChart data={eo.smap_rootzone.map(([d, v], i) => ({ d, root: v, surf: eo.smap_surface?.[i]?.[1] ?? null }))} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              {GRID}
              <XAxis dataKey="d" {...AX} tickLine={false} interval={24} />
              <YAxis {...AX} tickLine={false} axisLine={false} domain={[0, "auto"]} />
              <Tooltip {...TIP} formatter={(v: unknown) => fmt(Number(v), 3)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line isAnimationActive={anim} animationDuration={900} dataKey="root" name={lang === "ar" ? "الجذور" : "root zone"} stroke={SERIES.rain} strokeWidth={2} dot={false} />
              <Line isAnimationActive={anim} animationDuration={900} dataKey="surf" name={lang === "ar" ? "السطح" : "surface"} stroke={SERIES.et0} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {eo?.modis_lst && (
        <ChartCard title={lang === "ar" ? "حرارة سطح الأرض نهارًا (MODIS)" : "Daytime land-surface temperature (MODIS)"} note="MOD11A2, 2000–2026">
          <ResponsiveContainer>
            <LineChart data={eo.modis_lst.map(([d, v]) => ({ d, v }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              {GRID}
              <XAxis dataKey="d" {...AX} tickLine={false} interval={48} />
              <YAxis {...AX} tickLine={false} axisLine={false} unit="°" />
              <Tooltip {...TIP} formatter={(v: unknown) => `${fmt(Number(v), 1)} °C`} />
              <Line isAnimationActive={anim} animationDuration={900} dataKey="v" name="LST" stroke={SERIES.et0} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {eo?.imerg_annual && (
        <ChartCard title={lang === "ar" ? "المطر السنوي من GPM IMERG (مم)" : "Annual rain, GPM IMERG (mm)"} note="2001–2025">
          <ResponsiveContainer>
            <BarChart data={eo.imerg_annual} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              {GRID}
              <XAxis dataKey="year" {...AX} tickLine={false} interval={4} />
              <YAxis {...AX} tickLine={false} axisLine={false} />
              <Tooltip {...TIP} formatter={(v: unknown) => `${fmt(Number(v), 1)} mm`} />
              <Bar isAnimationActive={anim} animationDuration={900} dataKey="annual_mm" name="IMERG" fill={SERIES.rain} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {eo?.cmip6 && (
        <ChartCard title={lang === "ar" ? "تغيّر العظمى في الخمسينات (CMIP6، 5 موديلات)" : "2050s change in Tmax (CMIP6, 5-model mean)"} note="NEX-GDDP-CMIP6 · 2041–2060 vs 1995–2014">
          <ResponsiveContainer>
            <BarChart data={(lang === "ar" ? MONTHS_AR : MONTHS_EN).map((m, i) => ({ m, a: eo.cmip6!.ensemble.ssp245?.d_t[i], b: eo.cmip6!.ensemble.ssp585?.d_t[i] }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={2}>
              {GRID}
              <XAxis dataKey="m" {...AX} tickLine={false} />
              <YAxis {...AX} tickLine={false} axisLine={false} unit="°" />
              <Tooltip {...TIP} formatter={(v: unknown) => `+${fmt(Number(v), 2)} °C`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar isAnimationActive={anim} animationDuration={900} dataKey="a" name="SSP2-4.5" fill={SERIES.rain} radius={[6, 6, 0, 0]} />
              <Bar isAnimationActive={anim} animationDuration={900} dataKey="b" name="SSP5-8.5" fill={SERIES.et0} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {eo?.grace && (
        <ChartCard title={lang === "ar" ? "مخزون المية الإقليمي (GRACE، سم)" : "Regional water storage (GRACE, cm)"} note={lang === "ar" ? "تقريبي جدًا (~300 كم)" : "very coarse (~300 km)"}>
          <ResponsiveContainer>
            <LineChart data={eo.grace.map(([d, v]) => ({ d, v }))} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              {GRID}
              <XAxis dataKey="d" {...AX} tickLine={false} interval={36} />
              <YAxis {...AX} tickLine={false} axisLine={false} />
              <Tooltip {...TIP} formatter={(v: unknown) => `${fmt(Number(v), 1)} cm`} />
              <Line isAnimationActive={anim} animationDuration={900} dataKey="v" name="GRACE" stroke={SERIES.rain} strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
