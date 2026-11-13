"use client";
/** Farm profile card, presets, and the three selectors that pick a precomputed plan file. */
import type { Meta } from "@/lib/types";
import { fmt, useLang } from "@/lib/i18n";

export interface Selection {
  ecw: number;
  water: number;
  profile: string;
}

const PROFILE_EN: Record<string, string> = {
  balanced: "Balanced",
  profit_first: "Profit first",
  water_saving: "Save water",
  soil_building: "Build soil",
  this_farmer: "This farmer",
};
const CRIT: Record<string, [string, string]> = {
  profit: ["Profit", "الربح"],
  water_saving: ["Water", "المية"],
  salt_tolerance: ["Salt", "الملوحة"],
  soil_health: ["Soil", "التربة"],
  market_demand: ["Market", "السوق"],
  risk_climate: ["Weather", "الجو"],
};

export function FarmPanel({ meta, sel, onChange }: { meta: Meta; sel: Selection; onChange: (s: Selection) => void }) {
  const { t, lang } = useLang();
  const f = meta.farm;
  const crop = (id: string) => meta.crops.find((c) => c.id === id)?.[lang === "ar" ? "ar" : "en"] ?? id;
  const presets: { label: string; s: Selection; note: string }[] = [
    { label: t.presetF001, s: { ecw: f.well_ECw_dS_m, water: f.water_m3_per_day, profile: "this_farmer" }, note: `${f.well_ECw_dS_m} dS/m · ${f.water_m3_per_day} m³/d` },
    { label: t.presetSouth, s: { ecw: 5, water: f.water_m3_per_day, profile: sel.profile }, note: lang === "ar" ? "متوسط وادي وردان 4.9 dS/m" : "W. Wardan zone mean 4.9 dS/m" },
    { label: t.presetNorth, s: { ecw: 12, water: f.water_m3_per_day, profile: sel.profile }, note: lang === "ar" ? "متوسط المنطقة الشمالية 12.6 dS/m" : "North zone mean 12.6 dS/m" },
  ];
  const facts = [
    [t.area, `${fmt(f.area_feddan)} ${t.feddan}`],
    [t.irrigation, lang === "ar" ? "تنقيط" : f.irrigation_system],
    [t.livestock, `${f.livestock_heads} ${t.heads}`],
    [t.lastCrop, crop(f.last_crop)],
    [t.preferred, f.preferred_crops.map(crop).join(lang === "ar" ? "، " : ", ")],
    [t.avoid, f.avoid_crops.map(crop).join(", ")],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <div className="card p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">{lang === "ar" ? "المزرعة" : "Farm"} {f.farmer_id}</h3>
          <span className="text-xs text-slate-500">Farmer_Priorities · Soil_Baseline</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-slate-400">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5">
          <div className="text-xs text-slate-400">{t.presets}</div>
          <div className="mt-2 flex flex-col gap-2">
            {presets.map((p) => {
              const on = p.s.ecw === sel.ecw && p.s.water === sel.water && (p.s.profile === sel.profile);
              return (
                <button key={p.label} onClick={() => onChange(p.s)} className={`flex items-center justify-between rounded-xl border px-3 py-2 text-start text-sm transition ${on ? "border-nasa-cyan bg-nasa-cyan/10" : "border-white/10 hover:bg-white/5"}`}>
                  <span>{p.label}</span>
                  <span className="text-xs text-slate-400" dir="ltr">{p.note}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card space-y-6 p-5">
        <div>
          <div className="text-sm font-medium">{t.priorities}</div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {meta.profiles.map((p) => {
              const on = p.id === sel.profile;
              return (
                <button key={p.id} onClick={() => onChange({ ...sel, profile: p.id })} className={`rounded-xl border p-2.5 text-start transition ${on ? "border-nasa-cyan bg-nasa-cyan/10" : "border-white/10 hover:bg-white/5"}`} aria-pressed={on}>
                  <div className="text-sm font-medium">{lang === "ar" ? p.label_ar : PROFILE_EN[p.id]}</div>
                  <div className="mt-2 space-y-1">
                    {Object.entries(p.weights).filter(([, w]) => w > 0).map(([k, w]) => (
                      <div key={k} className="flex items-center gap-1.5">
                        <span className="w-12 shrink-0 text-[10px] text-slate-400">{CRIT[k][lang === "ar" ? 1 : 0]}</span>
                        <span className="h-1.5 rounded-full bg-nasa-cyan/70" style={{ width: `${w * 100}%` }} />
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-sm font-medium">{t.wellEcw}</div>
          <div className="mt-2 flex flex-wrap gap-2" dir="ltr">
            {meta.ecw_options.map((e) => (
              <button key={e} onClick={() => onChange({ ...sel, ecw: e })} className={`chip ${e === sel.ecw ? "chip-on" : "hover:bg-white/5"}`} aria-pressed={e === sel.ecw}>
                {e} {e === meta.farm.well_ECw_dS_m && <span className="text-[10px] text-sand-ink">F001</span>}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {lang === "ar" ? "آبار رأس سدر من 3.2 لـ 38 dS/m (39 بير، S17). قيس بيرك." : "Ras Sudr wells range 3.2–38 dS/m (39 wells, S17). Measure yours."}
          </p>
        </div>
        <div>
          <div className="text-sm font-medium">{t.waterSupply}</div>
          <div className="mt-2 flex flex-wrap gap-2" dir="ltr">
            {meta.water_options.map((w) => (
              <button key={w} onClick={() => onChange({ ...sel, water: w })} className={`chip ${w === sel.water ? "chip-on" : "hover:bg-white/5"}`} aria-pressed={w === sel.water}>
                {w} m³/d {w === meta.farm.water_m3_per_day && <span className="text-[10px] text-sand-ink">F001</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
