"use client";
/** Plan cards (6-season timeline, EGP profit with P10–P90 band, water, soil, robustness ring, 5-field card) + table. */
import { motion } from "framer-motion";
import type { CardFields, Meta, Plan, Season } from "@/lib/types";
import { fmt, signed, useLang } from "@/lib/i18n";
import { COPY } from "@/lib/copy";
import { PLAN_COLORS, cropStyle } from "@/lib/crops";
import { FlipCard, Ring, WithChips } from "./ui";

export function planLabel(p: Plan, lang: string) {
  return lang === "ar" ? p.view.label_ar : p.view.label_en;
}

function SlotCell({ s, estimated }: { s: Season; estimated: boolean }) {
  const { t, lang } = useLang();
  const st = cropStyle(s.crop_id);
  const fallow = s.crop_id === "fallow";
  return (
    <div
      className={`flex min-h-[92px] flex-col rounded-lg border p-1.5 text-[11px] leading-tight ${fallow ? "border-dashed border-white/15" : "border-white/10 bg-white/[0.04]"}`}
      style={fallow ? undefined : { borderTop: `3px solid ${st.color}` }}
    >
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{s.slot}</span>
        {estimated && !fallow && <span title="price estimated">*</span>}
      </div>
      <div className="mt-0.5 flex items-start gap-1 font-medium">
        <span aria-hidden className="text-base leading-none">{fallow ? "·" : st.icon}</span>
        <span className="break-words">{fallow ? t.fallow : lang === "ar" ? s.crop_ar : s.crop_en.replace(/ \(.+\)/, "")}</span>
      </div>
      {!fallow && (
        <div className="mt-auto text-slate-400">
          <bdi>{fmt(s.area_fdn, 1)}</bdi> {t.feddanShort}
          {s.profit_egp !== null && s.profit_egp !== undefined && (
            <div className={s.profit_egp >= 0 ? "text-emerald-300/80" : "text-rose-300/80"}>
              <bdi>{s.profit_egp >= 0 ? "+" : "−"}{fmt(Math.abs(s.profit_egp / 1000), 0)}k</bdi>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Timeline({ p, meta }: { p: Plan; meta?: Meta | null }) {
  const est = new Set(meta?.crops.filter((c) => c.price_estimated).map((c) => c.id) ?? []);
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {p.seasons.map((s) => (
        <SlotCell key={s.slot} s={s} estimated={est.has(s.crop_id)} />
      ))}
    </div>
  );
}

export function Explanation({ card, flips }: { card: CardFields; flips: string[] }) {
  const { t, lang } = useLang();
  const c = COPY[lang];
  const fields: [keyof CardFields, string, string][] = [
    ["why", t.why, "💡"],
    ["evidence", t.evidence, "🛰️"],
    ["benefits", t.benefits, "✅"],
    ["gaps", t.gaps, "❔"],
    ["risks", t.risks, "⚠️"],
  ];
  return (
    <div className="space-y-3">
      {fields.map(([k, title, icon]) => (
        <div key={k}>
          <div className="text-sm font-semibold text-ink">
            <span aria-hidden>{icon}</span> {title}
          </div>
          <ul className="mt-1 list-disc space-y-1 ps-5 text-[13px] leading-relaxed text-slate-300">
            {card[k].map((s, i) => (
              <li key={i}>{k === "evidence" ? <WithChips text={s} /> : s}</li>
            ))}
          </ul>
        </div>
      ))}
      {flips.length > 0 && (
        <p className="rounded-xl border border-brand-sand/40 bg-brand-sand/10 px-3 py-2 text-xs text-sand-ink">
          ⚖ {c.sensitive}: <span dir="ltr">{flips.slice(0, 5).join(", ")}</span>
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, sub, delta, goodDown }: { label: string; value: string; sub?: string; delta?: number | null; goodDown?: boolean }) {
  const { t } = useLang();
  const good = delta === undefined || delta === null || Math.abs(delta) < 0.5 ? null : goodDown ? delta < 0 : delta > 0;
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="truncate text-lg font-semibold tabular-nums text-ink" dir="ltr">{value}</div>
      {sub && <div className="text-[11px] text-slate-500" dir="ltr">{sub}</div>}
      {delta !== undefined && delta !== null && (
        <div className={`text-[11px] ${good === null ? "text-slate-500" : good ? "text-emerald-300" : "text-rose-300"}`}>
          <span dir="ltr">{signed(delta)}</span> {t.vsNow}
        </div>
      )}
    </div>
  );
}

export function PlanCard({ p, open, onToggle, highlight, meta, index = 0 }: { p: Plan; open: boolean; onToggle: () => void; highlight?: boolean; meta?: Meta | null; index?: number }) {
  const { lang } = useLang();
  const c = COPY[lang];
  const tot = p.totals;
  const isCur = p.kind === "current";
  const band = p.robustness.bands?.profit_egp;
  const color = PLAN_COLORS[p.kind];
  const head = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
          <h3 className="text-lg font-semibold text-ink">{planLabel(p, lang)}</h3>
        </div>
        {p.sameAs.length > 0 && <p className="mt-0.5 text-[11px] text-muted" dir="ltr">= {p.sameAs.join(", ")}</p>}
      </div>
      <Ring pct={p.robustness.robustness_pct} size={58} label={c.robust} />
    </div>
  );
  const front = (
    <div className="card flex h-full flex-col p-5" style={{ borderTop: `4px solid ${color}` }}>
      {head}
      <div className="mt-4">
        <Timeline p={p} meta={meta} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric
          label={c.profit3y}
          value={tot.value_kind === "profit_egp" ? `${fmt(tot.value / 1000, 0)}k EGP` : fmt(tot.value, 2)}
          sub={band ? `${c.band}: ${fmt(band.p10 / 1000, 0)}–${fmt(band.p90 / 1000, 0)}k` : undefined}
          delta={isCur ? undefined : tot.value_vs_current_pct}
        />
        <Metric label={c.water3y} value={`${fmt(tot.water_m3)} m³`} sub={tot.egp_per_m3 ? `${fmt(tot.egp_per_m3, 1)} ${c.egpPerM3}` : undefined} delta={isCur ? undefined : tot.water_vs_current_pct} goodDown />
        <Metric label={c.soil} value={`${fmt(tot.soil_index)}/100`} sub={`ECe ${fmt(tot.ECe_end, 1)} · ${fmt(tot.kg_per_m3, 2)} ${c.kgPerM3}`} />
      </div>
      <div className="mt-auto flex items-center justify-center gap-2 pt-5 text-sm font-medium text-brand">
        <span aria-hidden>↻</span> {c.why}
      </div>
    </div>
  );
  const back = (
    <div className="card flex h-full flex-col p-5" style={{ borderTop: `4px solid ${color}` }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">{planLabel(p, lang)}</h3>
        <span className="text-xs font-medium text-brand">↻ {c.hide}</span>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pe-1" data-noflip-scroll>
        <Explanation card={p.view.explanation[lang]} flips={p.view.rank_flips} />
      </div>
    </div>
  );
  return (
    <motion.div
      id={`plan-${p.kind}`}
      layout
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className={`scroll-mt-28 ${highlight ? "demo-ring" : ""}`}
    >
      <FlipCard label={`${planLabel(p, lang)} — ${open ? c.hide : c.why}`} flipped={open} onFlip={() => onToggle()} className="h-full" backScroll={false} front={front} back={back} />
    </motion.div>
  );
}

export function ComparisonTable({ plans }: { plans: Plan[] }) {
  const { t, lang } = useLang();
  const c = COPY[lang];
  const rows: [string, (p: Plan) => string][] = [
    [c.profit3y + " (EGP)", (p) => fmt(p.totals.value)],
    [c.perFdnYr, (p) => fmt(p.totals.profit_per_feddan_year)],
    [lang === "ar" ? "ربح P10–P90 (ألف جنيه)" : "Profit P10–P90 (k EGP)", (p) => (p.robustness.bands?.profit_egp ? `${fmt(p.robustness.bands.profit_egp.p10 / 1000)}–${fmt(p.robustness.bands.profit_egp.p90 / 1000)}` : "—")],
    [c.water3y + " (m³)", (p) => fmt(p.totals.water_m3)],
    [c.egpPerM3, (p) => fmt(p.totals.egp_per_m3, 1)],
    [c.kgPerM3, (p) => fmt(p.totals.kg_per_m3, 2)],
    [c.idle, (p) => fmt(p.totals.idle_fdn_avg, 1)],
    [c.soil, (p) => fmt(p.totals.soil_index)],
    [lang === "ar" ? "ملوحة التربة بعد 3 سنين (P10–P90)" : "Soil ECe after 3 yrs (P10–P90)", (p) => (p.robustness.bands ? `${fmt(p.totals.ECe_end, 2)} (${fmt(p.robustness.bands.ece_end.p10, 1)}–${fmt(p.robustness.bands.ece_end.p90, 1)})` : fmt(p.totals.ECe_end, 2))],
    [t.nitrogen, (p) => fmt(p.totals.N_end, 1)],
    [c.robust, (p) => `${fmt(p.robustness.robustness_pct)}%`],
    ...[100, 70, 40].map((lv) => [`${c.robust} · ${lv}% leaching`, (p: Plan) => `${fmt(p.robustness.by_leaching.find((b) => b.leach_pct === lv)?.pass_pct)}%`] as [string, (p: Plan) => string]),
  ];
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">{lang === "ar" ? "مقارنة الخطط" : "Plan comparison"}</caption>
        <thead>
          <tr className="border-b border-white/10 text-xs text-slate-400">
            <th className="p-3 text-start font-medium" scope="col"></th>
            {plans.map((p) => (
              <th key={p.kind} className="p-3 text-start font-medium" scope="col">
                <span className="me-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ background: PLAN_COLORS[p.kind] }} />
                {planLabel(p, lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} className="border-b border-white/5">
              <th scope="row" className="p-3 text-start font-normal text-slate-400">{label}</th>
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
