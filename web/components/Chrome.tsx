"use client";
/** Header (brand, navigation, language toggle, demo button) and footer shown on every page. */
import Link from "next/link";
import { useLang } from "@/lib/i18n";

export function Header({ onDemo, demoOn }: { onDemo?: () => void; demoOn?: boolean }) {
  const { t, lang, setLang } = useLang();
  const nav = [
    ["#story", lang === "ar" ? "من الفضاء" : "From space"],
    ["#farm", t.navFarm],
    ["#plans", t.navPlans],
    ["#whatif", t.navWhatIf],
    ["#glossary", t.navGlossary],
  ];
  return (
    <header className="sticky top-0 z-[1000] border-b border-white/10 bg-space-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="Dawra AI home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-semibold tracking-tight">
            Dawra <span className="text-nasa-cyan">AI</span>
            <span className="ms-2 font-ar text-sm text-slate-400">دورة</span>
          </span>
        </Link>
        <nav className="ms-4 hidden gap-1 lg:flex">
          {nav.map(([h, l]) => (
            <a key={h} href={`/${h}`} className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
              {l}
            </a>
          ))}
          <Link href="/nasa-data" className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
            {t.navNasa}
          </Link>
          <Link href="/farmer" className="rounded-lg px-3 py-1.5 text-sm text-nasa-amber hover:bg-white/5">
            {lang === "ar" ? "وضع المزارع" : "Farmer mode"}
          </Link>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          {onDemo && (
            <button
              onClick={onDemo}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${demoOn ? "bg-nasa-red/90 text-white" : "bg-nasa-amber text-space-950 hover:brightness-110"}`}
            >
              {demoOn ? `■ ${t.demoStop}` : `▶ ${t.demo}`}
            </button>
          )}
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="rounded-full border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
            aria-label="Switch language"
          >
            {t.langToggle}
          </button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
        {nav.map(([h, l]) => (
          <a key={h} href={`/${h}`} className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5">
            {l}
          </a>
        ))}
        <Link href="/nasa-data" className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5">
          {t.navNasa}
        </Link>
      </nav>
    </header>
  );
}

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-16 border-t border-white/10 bg-space-950/60">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm">
        <p className="rounded-xl border border-nasa-amber/40 bg-nasa-amber/10 px-4 py-3 font-medium text-nasa-amber">
          ⚠ {t.footer}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-400">
          <span>{t.builtWith}</span>
          <Link href="/nasa-data" className="underline-offset-4 hover:underline">
            {t.navNasa}
          </Link>
          <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
            NASA POWER
          </a>
        </div>
      </div>
    </footer>
  );
}

export function Section({ id, title, lead, children, highlight }: { id: string; title: string; lead?: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-28 rounded-3xl p-1 transition ${highlight ? "demo-ring" : ""}`}>
      <div className="mb-5">
        <h2 className="section-title">{title}</h2>
        {lead && <p className="muted mt-2 max-w-3xl">{lead}</p>}
      </div>
      {children}
    </section>
  );
}
