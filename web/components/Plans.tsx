"use client";
/** Plan cards (6-season timeline, metrics, robustness badge, 5-field explanation), comparison table,
 *  soil trajectory chart and the Pareto trade-off scatter. */
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Cell,
} from "recharts";
import type { CardFields, Plan, PlanFile, Season } from "@/lib/types";
import { fmt, signed, useLang } from "@/lib/i18n";
import { PLAN_COLORS, cropStyle } from "@/lib/crops";

const AX = { stroke: "#64748b", fontSize: 11 };
const TIP = { contentStyle: { background: "#0a1024", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, fontSize: 12 }, labelStyle: { color: "#e6e9f2" } };

export function planLabel(p: Plan, lang: string) {
  return lang === "ar" ? p.label_ar : p.label_en;
}

export function RobustBadge({ pct }: { pct: number }) {
  const { lang } = useLang();
  const [cls, icon, en, ar] =
    pct >= 90 ? ["border-emerald-400/60 text-emerald-300", "✔", "Robust", "قوية"]
    : pct >= 70 ? ["border-amber-400/60 text-amber-300", "▲", "Mostly OK", "مقبولة"]
    : ["border-rose-400/60 text-rose-300", "✖", "Fragile", "ضعيفة"];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      <span aria-hidden>{icon}</span> {lang === "ar" ? ar : en} · {fmt(pct)}%
    </span>
  );
}

function SlotCell({ s }: { s: Season }) {
  const { t, lang } = useLang();
  const st = cropStyle(s.crop_id);
  const fallow = s.crop_id === "fallow";
  return (
    <div
      className={`flex min-h-[86px] flex-col rounded-lg border p-1.5 text-[11px] leading-tight ${fallow ? "border-dashed border-white/15 bg-transparent" : "border-white/10 bg-white/[0.04]"}`}
      style={fallow ? undefined : { borderTop: `3px solid ${st.color}` }}
      title={fallow ? t.fallow : `${lang === "ar" ? s.crop_ar : s.crop_en}`}
    >
      <div className="text-[10px] text-slate-500">{s.slot}</div>
      <div className="mt-0.5 flex items-center gap-1 font-medium">
        <span aria-hidden>{fallow ? "—" : st.icon}</span>
        <span className="break-words">{fallow ? t.fallow : lang === "ar" ? s.crop_ar : s.crop_en.replace(/ \(.+\)/, "")}</span>
      </div>
      {!fallow && (
        <div className="mt-auto text-slate-400">
          <bdi>{fmt(s.area_fdn, 1)}</bdi> {t.feddanShort} · <bdi>{fmt(s.rel_yield_pct)}%</bdi>
        </div>
      )}
      {s.part === 1 && <div className="text-[10px] text-slate-500">{lang === "ar" ? "مكمّل" : "cont."}</div>}
    </div>
  );
}

export function Timeline({ p }: { p: Plan }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {p.seasons.map((s) => (
        <SlotCell key={s.slot} s={s} />
      ))}
    </div>
  );
}

function Metric({ label, value, delta, goodDown }: { label: string; value: string; delta?: number | null; goodDown?: boolean }) {
  const { t } = useLang();
  const good = delta === undefined || delta === null || Math.abs(delta) < 0.5 ? null : goodDown ? delta < 0 : delta > 0;
  return (
    <div>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums" dir="ltr">{value}</div>
      {delta !== undefined && delta !== null && (
        <div className={`text-[11px] ${good === null ? "text-slate-500" : good ? "text-emerald-300" : "text-rose-300"}`}>
          <span dir="ltr">{signed(delta)}</span> {t.vsNow}
        </div>
      )}
    </div>
  );
}

export function Explanation({ card }: { card: CardFields }) {
  const { t } = useLang();
  const fields: [keyof CardFields, string, string][] = [
    ["why", t.why, "💡"],
    ["evidence", t.evidence, "🛰️"],
    ["benefits", t.benefits, "✅"],
    ["gaps", t.gaps, "❔"],
    ["risks", t.risks, "⚠️"],
  ];
  return (
    <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
      {fields.map(([k, title, icon]) => (
        <div key={k}>
          <div className="text-sm font-semibold">
            <span aria-hidden>{icon}</span> {title}
          </div>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-slate-300">
            {card[k].map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function PlanCard({ p, open, onToggle, highlight }: { p: Plan; open: boolean; onToggle: () => void; highlight?: boolean }) {
  const { t, lang } = useLang();
  const tot = p.totals;
  const color = PLAN_COLORS[p.kind];
  const isCur = p.kind === "current";
  const valueLabel = tot.value_kind === "productivity_index" ? t.output : t.profit;
  return (
    <article id={`plan-${p.kind}`} className={`card scroll-mt-28 p-4 ${highlight ? "demo-ring" : ""}`} style={{ borderInlineStartWidth: 4, borderInlineStartColor: color }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} aria-hidden />
        <h3 className="text-base font-semibold">{planLabel(p, lang)}</h3>
        <span className="ms-auto">
          <RobustBadge pct={p.robustness.robustness_pct} />
        </span>
      </div>
      {p.same_as.length > 0 && (
        <p className="mt-1 text-xs text-slate-500">
          {t.sameAs}: {p.same_as.join(", ")}
        </p>
      )}
      <div className="mt-3">
        <Timeline p={p} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Metric label={t.water3y} value={`${fmt(tot.water_m3)} m³`} delta={isCur ? undefined : tot.water_vs_current_pct} goodDown />
        <Metric label={valueLabel} value={tot.value_kind === "profit_egp" ? `${fmt(tot.value)} EGP` : fmt(tot.value, 2)} delta={isCur ? undefined : tot.value_vs_current_pct} />
        <Metric label={t.soilScore} value={`${fmt(tot.soil_index)}/100`} />
      </div>
      <button onClick={onToggle} className="mt-4 w-full rounded-xl border border-white/15 py-2 text-sm hover:bg-white/5" aria-expanded={open}>
        {open ? t.hideWhy : t.showWhy}
      </button>
      {open && <Explanation card={p.explanation[lang]} />}
    </article>
  );
}

export function ComparisonTable({ plans }: { plans: Plan[] }) {
  const { t, lang } = useLang();
  const rows: [string, (p: Plan) => string][] = [
    [t.water3y + " (m³)", (p) => fmt(p.totals.water_m3)],
    [lang === "ar" ? "المية في السنة (م³)" : "Water per year (m³)", (p) => fmt(p.totals.water_m3_per_year)],
    [plans[0]?.totals.value_kind === "productivity_index" ? t.output : t.profit, (p) => (p.totals.value_kind === "profit_egp" ? `${fmt(p.totals.value)} EGP` : fmt(p.totals.value, 2))],
    [t.soilScore, (p) => fmt(p.totals.soil_index)],
    [lang === "ar" ? "ملوحة التربة بعد 3 سنين" : "Soil ECe after 3 yrs (dS/m)", (p) => fmt(p.totals.ECe_end, 2)],
    [t.nitrogen, (p) => fmt(p.totals.N_end, 1)],
    [lang === "ar" ? "أقل إنتاج نسبي" : "Lowest relative yield", (p) => `${fmt(p.totals.min_rel_yield)}%`],
    [lang === "ar" ? "مواسم مزروعة" : "Cropped seasons", (p) => `${p.totals.cropped_seasons}/6`],
    [t.robust, (p) => `${fmt(p.robustness.robustness_pct)}%`],
  ];
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-start text-xs text-slate-400">
            <th className="p-3 text-start font-medium"></th>
            {plans.map((p) => (
              <th key={p.kind} className="p-3 text-start font-medium">
                <span className="me-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[p.kind] }} />
                {planLabel(p, lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} className="border-b border-white/5">
              <td className="p-3 text-slate-400">{label}</td>
              {plans.map((p) => (
                <td key={p.kind} className="p-3 tabular-nums" dir="ltr" style={{ textAlign: lang === "ar" ? "right" : "left" }}>
                  {f(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SoilChart({ plans }: { plans: Plan[] }) {
  const { t, lang } = useLang();
  const [metric, setMetric] = useState<"ece" | "soc" | "n">("ece");
  const labels = { ece: t.ece, soc: t.soc, n: t.nitrogen };
  const steps = plans[0]?.soil_trajectory.map((s) => s.t) ?? [];
  const data = steps.map((step, i) => {
    const row: Record<string, number | string> = { t: step === "start" ? (lang === "ar" ? "البداية" : "start") : step };
    plans.forEach((p) => (row[p.kind] = p.soil_trajectory[i][metric]));
    return row;
  });
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">{t.soilTrajTitle}</h3>
        <div className="ms-auto flex gap-1">
          {(["ece", "soc", "n"] as const).map((m) => (
            <button key={m} onClick={() => setMetric(m)} className={`chip text-xs ${metric === m ? "chip-on" : "hover:bg-white/5"}`}>
              {labels[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-64" dir="ltr">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="#fff" strokeOpacity={0.06} vertical={false} />
            <XAxis dataKey="t" {...AX} tickLine={false} />
            <YAxis {...AX} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
            <Tooltip {...TIP} formatter={(v: unknown) => fmt(Number(v), metric === "soc" ? 3 : metric === "ece" ? 2 : 1)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {plans.map((p) => (
              <Line isAnimationActive={false} key={p.kind} dataKey={p.kind} name={planLabel(p, lang)} stroke={PLAN_COLORS[p.kind]} strokeWidth={2} dot={{ r: 4 }} strokeDasharray={p.kind === "current" ? "5 4" : undefined} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const SEQ = ["#0f3d2e", "#146b4f", "#199e70", "#4cc08f", "#8fe0b8"]; // sequential: one hue, dark→light on dark bg

export function TradeoffChart({ file }: { file: PlanFile }) {
  const { t, lang } = useLang();
  const soils = file.front.map((f) => f.soil);
  const lo = Math.min(...soils);
  const hi = Math.max(...soils);
  const bin = (s: number) => SEQ[Math.min(SEQ.length - 1, Math.floor(((s - lo) / Math.max(hi - lo, 1e-9)) * SEQ.length))];
  const picks = file.plans.map((p) => ({ x: p.totals.water_m3, y: p.totals.value, kind: p.kind, name: planLabel(p, lang) }));
  const yLabel = file.plans[0]?.totals.value_kind === "productivity_index" ? t.output : t.profit;
  return (
    <div className="card p-4">
      <h3 className="text-sm font-medium">{t.tradeoffTitle} ({file.front_size})</h3>
      <p className="mt-0.5 text-xs text-slate-500">{t.tradeoffLead}</p>
      <div className="mt-3 h-72" dir="ltr">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
            <CartesianGrid stroke="#fff" strokeOpacity={0.06} />
            <XAxis type="number" dataKey="x" name={t.water3y} {...AX} tickFormatter={(v) => `${Math.round(v / 1000)}k`} label={{ value: `${t.water3y} (m³)`, position: "insideBottom", offset: -8, fill: "#94a3b8", fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name={yLabel} {...AX} domain={["auto", "auto"]} />
            <ZAxis range={[40, 40]} />
            <Tooltip
              {...TIP}
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(v: unknown, n: unknown) => [n === t.water3y ? `${fmt(Number(v))} m³` : fmt(Number(v), 2), String(n)]}
            />
            <Scatter isAnimationActive={false} name="front" data={file.front.map((f) => ({ x: f.water_m3, y: f.value, soil: f.soil }))}>
              {file.front.map((f, i) => (
                <Cell key={i} fill={bin(f.soil)} />
              ))}
            </Scatter>
            {picks.map((p) => (
              <Scatter isAnimationActive={false} key={p.kind} name={p.name} data={[p]} fill={PLAN_COLORS[p.kind]} shape="diamond" legendType="diamond" />
            ))}
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} payload={picks.map((p) => ({ value: p.name, type: "diamond" as const, color: PLAN_COLORS[p.kind], id: p.kind }))} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500" dir="ltr">
        <span>{t.soilScore}: {fmt(lo)}</span>
        {SEQ.map((c) => (
          <span key={c} className="h-2 w-5 rounded-sm" style={{ background: c }} />
        ))}
        <span>{fmt(hi)}</span>
      </div>
    </div>
  );
}
