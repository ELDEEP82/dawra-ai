"use client";
/** Header (brand, nav, single language toggle, scroll progress), sticky section titles and footer. */
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLang } from "@/lib/i18n";

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${h > 0 ? window.scrollY / h : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div ref={ref} aria-hidden className="fixed inset-x-0 top-0 z-[1100] h-[3px] origin-left scale-x-0 bg-gradient-to-r from-brand via-brand-leaf to-brand-sky transition-transform duration-150 ease-out rtl:origin-right" />;
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  const next = lang === "ar" ? "en" : "ar";
  return (
    <button
      onClick={() => setLang(next)}
      className="inline-flex min-h-[44px] min-w-[72px] items-center justify-center rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink shadow-card transition hover:border-brand/40 hover:bg-brand-soft"
      aria-label={lang === "ar" ? "Switch to English" : "التحويل للعربي"}
      lang={next}
    >
      {lang === "ar" ? "English" : "عربي"}
    </button>
  );
}

export function Header() {
  const { t, lang } = useLang();
  const nav: [string, string][] = [
    ["/#story", lang === "ar" ? "من الفضاء" : "From space"],
    ["/#farm", t.navFarm],
    ["/#plans", t.navPlans],
    ["/#whatif", t.navWhatIf],
    ["/nasa-data", t.navNasa],
    ["/farmer", lang === "ar" ? "وضع المزارع" : "Farmer mode"],
  ];
  return (
    <>
      <ScrollProgress />
      <header className="sticky top-0 z-[1000] border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-h-[44px] items-center gap-2" aria-label="Dawra AI home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight text-ink">
              Dawra <span className="text-brand">AI</span>
              <span className="ms-2 font-ar text-sm font-medium text-muted">دورة</span>
            </span>
          </Link>
          <nav className="ms-6 hidden gap-1 lg:flex" aria-label="Main">
            {nav.map(([h, l]) => (
              <Link key={h} href={h} className={`rounded-full px-3 py-2 text-sm transition hover:bg-brand-soft hover:text-brand ${h === "/farmer" ? "font-semibold text-brand" : "text-slate-300"}`}>
                {l}
              </Link>
            ))}
          </nav>
          <div className="ms-auto">
            <LangToggle />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="Sections">
          {nav.map(([h, l]) => (
            <Link key={h} href={h} className="inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full px-3 text-xs text-slate-300 hover:bg-brand-soft">
              {l}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-24 border-t border-line bg-paper">
      <div className="mx-auto max-w-7xl px-4 py-10 text-sm">
        <p className="rounded-2xl border border-brand-sand/40 bg-brand-sand/10 px-4 py-3 font-medium text-sand-ink">⚠ {t.footer}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-muted">
          <span>{t.builtWith}</span>
          <Link href="/nasa-data" className="underline-offset-4 hover:text-brand hover:underline">{t.navNasa}</Link>
          <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-brand hover:underline">NASA POWER</a>
          <a href="https://github.com/ELDEEP82/dawra-ai" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-brand hover:underline">GitHub</a>
        </div>
      </div>
    </footer>
  );
}

export function Section({ id, title, lead, children, highlight }: { id: string; title: string; lead?: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <section id={id} className={`scroll-mt-24 ${highlight ? "demo-ring p-2" : ""}`}>
      <div className="sticky top-[100px] z-20 -mx-4 mb-4 border-b border-line/70 bg-canvas/[0.97] px-4 py-2.5 backdrop-blur-md lg:top-[57px]">
        <h2 className="section-title">{title}</h2>
      </div>
      {lead && <p className="muted mb-6 max-w-3xl text-base">{lead}</p>}
      {children}
    </section>
  );
}
