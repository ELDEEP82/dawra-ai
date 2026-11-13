"use client";
/** App-style navigation: sticky segmented tabs (desktop) + bottom tab bar (mobile), ARIA tabs with arrow keys. */
import { Database, LayoutGrid, Satellite, SlidersHorizontal, Sprout, type LucideIcon } from "lucide-react";
import type { Lang } from "@/lib/types";

export type TabId = "farm" | "plans" | "whatif" | "evidence" | "nasa";
export const TABS: { id: TabId; icon: LucideIcon; en: string; ar: string; enShort?: string; arShort?: string }[] = [
  { id: "farm", icon: Sprout, en: "Your farm", ar: "مزرعتك" },
  { id: "plans", icon: LayoutGrid, en: "Plans", ar: "الخطط" },
  { id: "whatif", icon: SlidersHorizontal, en: "What-if", ar: "لو حصل" },
  { id: "evidence", icon: Satellite, en: "Satellite evidence", ar: "دليل الأقمار", enShort: "Satellite", arShort: "الأقمار" },
  { id: "nasa", icon: Database, en: "NASA data", ar: "بيانات ناسا" },
];

function onKey(e: React.KeyboardEvent, tab: TabId, set: (t: TabId) => void, rtl: boolean) {
  const i = TABS.findIndex((t) => t.id === tab);
  const next = (d: number) => TABS[(i + d + TABS.length) % TABS.length].id;
  const fwd = rtl ? "ArrowLeft" : "ArrowRight", back = rtl ? "ArrowRight" : "ArrowLeft";
  let t: TabId | null = null;
  if (e.key === fwd) t = next(1);
  if (e.key === back) t = next(-1);
  if (e.key === "Home") t = TABS[0].id;
  if (e.key === "End") t = TABS[TABS.length - 1].id;
  if (t) {
    e.preventDefault();
    set(t);
    document.getElementById(`tab-${t}`)?.focus();
  }
}

export function TabNav({ tab, onChange, lang }: { tab: TabId; onChange: (t: TabId) => void; lang: Lang }) {
  const rtl = lang === "ar";
  return (
    <>
      <div id="app-tabs" className="sticky top-[57px] z-30 -mx-4 hidden scroll-mt-20 border-b border-line/70 bg-canvas/[0.97] px-4 py-3 backdrop-blur-md sm:block">
        <div role="tablist" aria-label={rtl ? "أقسام التطبيق" : "App sections"} className="mx-auto flex max-w-[1200px] gap-1 rounded-full border border-line bg-paper p-1 shadow-card" onKeyDown={(e) => onKey(e, tab, onChange, rtl)}>
          {TABS.map((t, i) => {
            const on = t.id === tab;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                aria-selected={on}
                aria-controls={`panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => onChange(t.id)}
                className={`relative flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 ${on ? "bg-brand text-paper shadow-glow" : "text-slate-300 hover:bg-brand-soft hover:text-brand"}`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${on ? "bg-paper/20" : "bg-space-900"}`} aria-hidden>
                  {i + 1}
                </span>
                <Icon size={16} aria-hidden />
                <span className="whitespace-nowrap">{rtl ? t.ar : t.en}</span>
              </button>
            );
          })}
        </div>
      </div>
      <nav aria-label={rtl ? "أقسام التطبيق" : "App sections"} className="fixed inset-x-0 bottom-0 z-[1100] border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const on = t.id === tab;
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => onChange(t.id)} aria-current={on ? "page" : undefined} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-brand" : "text-muted"}`}>
                <Icon size={20} strokeWidth={on ? 2.4 : 2} aria-hidden />
                <span className="max-w-full truncate px-1">{rtl ? t.arShort ?? t.ar : t.enShort ?? t.en}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
