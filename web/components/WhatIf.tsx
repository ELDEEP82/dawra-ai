"use client";
/** What-if sliders reading the precomputed 7×4×4 stress grid of each plan (instant, no server). */
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Meta, Plan, WhatIfCell } from "@/lib/types";
import { fmt, signed, useLang } from "@/lib/i18n";
import { PLAN_COLORS } from "@/lib/crops";
import { RobustBadge, planLabel } from "./Plans";

export interface WhatIfState {
  kind: string;
  dT: number;
  dRain: number;
  dECw: number;
}

function cell(p: Plan, s: WhatIfState): WhatIfCell | undefined {
  return p.whatif.find((c) => c.dT === s.dT && c.dRain === s.dRain && c.dECw === s.dECw);
}

function Slider({ label, value, min, max, step, onChange, fmtV }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmtV: (v: number) => string }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-nasa-cyan" dir="ltr">{fmtV(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full" dir="ltr" />
    </label>
  );
}

export function WhatIf({ plans, meta, state, onChange }: { plans: Plan[]; meta: Meta; state: WhatIfState; onChange: (s: WhatIfState) => void }) {
  const { t, lang } = useLang();
  const plan = plans.find((p) => p.kind === state.kind) ?? plans[0];
  const base = cell(plan, { ...state, dT: 0, dRain: 0, dECw: 0 });
  const cur = cell(plan, state);
  const g = meta.grid;
  const data = useMemo(
    () =>
      plan.seasons.map((s, i) => ({
        slot: s.slot,
        name: `${s.slot} ${s.crop_id === "fallow" ? (lang === "ar" ? "بور" : "fallow") : lang === "ar" ? s.crop_ar : s.crop_en.replace(/ \(.+\)/, "")}`,
        base: base?.rel_yield[i] ?? null,
        now: cur?.rel_yield[i] ?? null,
      })),
    [plan, base, cur, lang],
  );
  const allRob = plans.map((p) => ({ p, c: cell(p, state) }));
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="card space-y-5 p-5">
        <div>
          <div className="text-sm">{t.choosePlan}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plans.map((p) => (
              <button key={p.kind} onClick={() => onChange({ ...state, kind: p.kind })} className={`chip text-xs ${p.kind === plan.kind ? "chip-on" : "hover:bg-white/5"}`}>
                <span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[p.kind] }} />
                {planLabel(p, lang)}
              </button>
            ))}
          </div>
        </div>
        <Slider label={t.hotter} value={state.dT} min={g.dT[0]} max={g.dT[g.dT.length - 1]} step={0.5} onChange={(v) => onChange({ ...state, dT: v })} fmtV={(v) => `+${fmt(v, 1)} °C`} />
        <Slider label={t.drier} value={-state.dRain} min={0} max={30} step={10} onChange={(v) => onChange({ ...state, dRain: -v })} fmtV={(v) => (v === 0 ? "0%" : `−${fmt(v)}%`)} />
        <Slider label={t.saltier} value={state.dECw} min={0} max={3} step={1} onChange={(v) => onChange({ ...state, dECw: v })} fmtV={(v) => `+${fmt(v)} dS/m`} />
        <div className="space-y-1.5 border-t border-white/10 pt-4 text-xs">
          <div className="text-slate-400">{t.robustThis}</div>
          {allRob.map(({ p, c }) => (
            <div key={p.kind} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[p.kind] }} />
              <span className="flex-1 truncate">{planLabel(p, lang)}</span>
              <span className="tabular-nums" dir="ltr">{c ? `${fmt(c.robustness)}%` : "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-semibold">{planLabel(plan, lang)}</h3>
          {cur && <RobustBadge pct={cur.robustness} />}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-slate-400">{t.waterUse}</div>
            <div className="kpi" dir="ltr">{cur ? `${fmt(cur.water_m3)} m³` : "—"}</div>
            {cur && base && <div className="text-xs text-slate-500" dir="ltr">{signed(((cur.water_m3 / base.water_m3) - 1) * 100)} vs {t.baseline}</div>}
          </div>
          <div>
            <div className="text-xs text-slate-400">{t.ecEnd}</div>
            <div className="kpi" dir="ltr">{cur ? `${fmt(cur.ece_end, 2)} dS/m` : "—"}</div>
            {base && <div className="text-xs text-slate-500" dir="ltr">{fmt(base.ece_end, 2)} · {t.baseline}</div>}
          </div>
          <div>
            <div className="text-xs text-slate-400">{t.robust}</div>
            <div className="kpi" dir="ltr">{cur ? `${fmt(cur.robustness)}%` : "—"}</div>
            {base && <div className="text-xs text-slate-500" dir="ltr">{fmt(base.robustness)}% · {t.baseline}</div>}
          </div>
        </div>
        <div className="mt-5 text-sm font-medium">{t.yieldBySeason}</div>
        <div className="mt-2 h-64" dir="ltr">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={2}>
              <CartesianGrid stroke="#fff" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} interval={0} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ background: "#0a1024", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, fontSize: 12 }} formatter={(v: unknown) => (v === null || v === undefined ? "—" : `${fmt(Number(v), 1)}%`)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar isAnimationActive={false} dataKey="base" name={t.baseline} fill="#64748b" radius={[3, 3, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="now" name={t.thisCase} fill={PLAN_COLORS[plan.kind]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {lang === "ar"
            ? "الأرض المزروعة متحددة قبل الموسم من المناخ العادي؛ لو الجو أحر أو البير أملح والبير مش مكفّي، أول حاجة بتتقطع هي مية الغسيل (الملح بيزيد) وبعدين مية الزرع."
            : "Planted area is fixed before the season from normal climate; if it gets hotter or the well saltier and the well can't keep up, leaching water is cut first (salt rises), then crop water."}
        </p>
      </div>
    </div>
  );
}
