"use client";
/** What-if lab: temperature, rain, well salinity and leaching achieved → precomputed 7×4×4×3 grid (instant). */
import { motion } from "framer-motion";
import type { Meta, Plan } from "@/lib/types";
import { whatifCell } from "@/lib/data";
import { fmt, signed, useLang } from "@/lib/i18n";
import { COPY } from "@/lib/copy";
import { PLAN_COLORS } from "@/lib/crops";
import { Ring, Tween } from "./ui";
import { CropIcon } from "./CropIcon";
import { planLabel } from "./Plans";

export interface WhatIfState {
  kind: string;
  dT: number;
  dRain: number;
  dECw: number;
  leach: number;
}

function Slider({ label, value, values, onChange, fmtV }: { label: string; value: number; values: number[]; onChange: (v: number) => void; fmtV: (v: number) => string }) {
  const i = Math.max(0, values.indexOf(value));
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-nasa-cyan" dir="ltr">{fmtV(value)}</span>
      </div>
      <input type="range" min={0} max={values.length - 1} step={1} value={i} onChange={(e) => onChange(values[Number(e.target.value)])} className="mt-2 w-full" dir="ltr" aria-valuetext={fmtV(value)} />
    </label>
  );
}

export function WhatIf({ plans, meta, state, onChange }: { plans: Plan[]; meta: Meta; state: WhatIfState; onChange: (s: WhatIfState) => void }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const uniq = plans.filter((p, i, a) => a.findIndex((q) => q.view.sig === p.view.sig) === i);
  const plan = uniq.find((p) => p.kind === state.kind) ?? uniq[0];
  const g = meta.grid;
  const base = whatifCell(plan.whatif, 0, 0, 0, 100);
  const cur = whatifCell(plan.whatif, state.dT, state.dRain, state.dECw, state.leach);
  const ys = [1, 2, 3, 4, 5, 6].map((k) => ({ slot: plan.seasons[k - 1], base: base?.[`y${k}`] ?? null, now: cur?.[`y${k}`] ?? null }));
  const pct = (a?: number | null, b?: number | null) => (a !== null && a !== undefined && b ? ((a - b) / Math.abs(b)) * 100 : null);
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="card space-y-5 p-5">
        <div className="flex flex-wrap gap-1.5">
          {uniq.map((p) => (
            <button key={p.kind} onClick={() => onChange({ ...state, kind: p.kind })} className={`chip text-xs ${p.kind === plan.kind ? "chip-on" : "hover:bg-white/5"}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[p.kind] }} />
              {planLabel(p, lang)}
            </button>
          ))}
        </div>
        <Slider label={c.hotter} value={state.dT} values={g.dT} onChange={(v) => onChange({ ...state, dT: v })} fmtV={(v) => `+${fmt(v, 1)} °C`} />
        <Slider label={c.drier} value={state.dRain} values={g.dRain} onChange={(v) => onChange({ ...state, dRain: v })} fmtV={(v) => (v === 0 ? "0%" : `−${fmt(-v)}%`)} />
        <Slider label={c.saltier} value={state.dECw} values={g.dECw} onChange={(v) => onChange({ ...state, dECw: v })} fmtV={(v) => `+${fmt(v)} dS/m`} />
        <Slider label={c.leaching} value={state.leach} values={[...g.leach].sort((a, b) => b - a)} onChange={(v) => onChange({ ...state, leach: v })} fmtV={(v) => `${fmt(v)}%`} />
      </div>
      <div className="card p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Ring pct={Number(cur?.robustness ?? 0)} size={84} label={c.robust} />
          <div className="grid w-full flex-1 grid-cols-3 gap-3 sm:gap-4">
            <div>
              <div className="text-xs text-slate-400">{c.profit}</div>
              <div className="whitespace-nowrap text-lg font-semibold tabular-nums sm:text-2xl"><Tween value={cur?.profit_egp !== null && cur?.profit_egp !== undefined ? Number(cur.profit_egp) / 1000 : null} suffix="k" /></div>
              <div className="text-[11px] text-slate-500" dir="ltr">{signed(pct(cur?.profit_egp, base?.profit_egp))} {c.vsToday}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">{c.water}</div>
              <div className="whitespace-nowrap text-lg font-semibold tabular-nums sm:text-2xl"><Tween value={cur?.water_m3 ?? null} suffix=" m³" /></div>
              <div className="text-[11px] text-slate-500" dir="ltr">{signed(pct(cur?.water_m3, base?.water_m3))} {c.vsToday}</div>
            </div>
            <div>
              <div className="truncate text-xs text-slate-400">{c.saltEnd}</div>
              <div className={`whitespace-nowrap text-lg font-semibold tabular-nums sm:text-2xl ${Number(cur?.ece_end) > 8.56 ? "text-rose-300" : ""}`}><Tween value={cur?.ece_end ?? null} nd={2} /></div>
              <div className="text-[11px] text-slate-500" dir="ltr">dS/m · start 8.56</div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-sm font-medium">{c.yields}</div>
        <div className="mt-3 space-y-2">
          {ys.map(({ slot, base: b, now }) => (
            <div key={slot.slot} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-xs sm:grid-cols-[150px_1fr_48px]">
              <span className="truncate text-slate-300">
                {slot.slot} <CropIcon id={slot.crop_id} size={13} className="inline align-[-2px]" /> {lang === "ar" ? slot.crop_ar : slot.crop_en.replace(/ \(.+\)/, "")}
              </span>
              <div className="relative h-3 rounded-full bg-white/5" dir="ltr">
                {b !== null && <div className="absolute inset-y-0 start-0 rounded-full bg-slate-500/50" style={{ width: `${b}%` }} />}
                {now !== null && (
                  <motion.div className="absolute inset-y-0 start-0 rounded-full" style={{ background: PLAN_COLORS[plan.kind] }} animate={{ width: `${now}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                )}
              </div>
              <span className="text-end tabular-nums" dir="ltr">{now === null ? "—" : `${fmt(now)}%`}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          {lang === "ar"
            ? "الرمادي = مناخ النهارده بغسيل كامل. المساحة متحددة قبل الموسم؛ لو البير مش مكفّي، أول حاجة بتتقطع مية الغسيل (الملح يزيد) وبعدين مية الزرع."
            : "Grey = today's climate with full leaching. Area is fixed before the season; if the well can't keep up, leaching water is cut first (salt rises), then crop water."}
        </p>
      </div>
    </div>
  );
}
