"use client";
/** Header (brand, NASA data, Farmer mode, single language toggle, scroll progress) and footer. */
import Link from "next/link";
import { useEffect, useRef } from "react";
import { AlertTriangle, Tractor } from "lucide-react";
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
      className="inline-flex min-h-[44px] min-w-[64px] items-center justify-center rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink shadow-card transition hover:border-brand/40 hover:bg-brand-soft"
      aria-label={lang === "ar" ? "Switch to English" : "التحويل للعربي"}
      lang={next}
    >
      {lang === "ar" ? "English" : "عربي"}
    </button>
  );
}

export function Header() {
  const { t, lang } = useLang();
  const ar = lang === "ar";
  return (
    <>
      <ScrollProgress />
      <header className="sticky top-0 z-[1000] border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4">
          <Link prefetch={false} href={`/${lang}`} className="flex min-h-[44px] items-center gap-2" aria-label="Dawra AI home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" width={30} height={30} className="rounded-lg" />
            <span className="text-lg font-semibold tracking-tight text-ink">
              Dawra <span className="text-brand">AI</span>
              <span className="ms-2 hidden font-ar text-sm font-medium text-muted sm:inline">دورة</span>
            </span>
          </Link>
          <nav className="ms-auto flex items-center gap-2" aria-label="Main">
            <Link prefetch={false} href={`/${lang}/nasa-data`} className="hidden min-h-[44px] items-center rounded-full px-3 text-sm text-slate-300 transition hover:bg-brand-soft hover:text-brand md:inline-flex">
              {t.navNasa}
            </Link>
            <Link prefetch={false} href="/ar/farmer" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3 text-sm font-semibold text-brand transition hover:bg-brand hover:text-paper">
              <Tractor size={16} aria-hidden />
              <span>{ar ? "وضع المزارع" : "Farmer mode"}</span>
            </Link>
            <LangToggle />
          </nav>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const { t, lang } = useLang();
  return (
    <footer className="mt-16 border-t border-line bg-paper">
      <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-10 text-sm sm:pb-10">
        <p className="rounded-2xl border border-brand-sand/40 bg-brand-sand/10 px-4 py-3 font-medium text-sand-ink"><AlertTriangle size={16} className="me-1.5 inline align-[-3px]" aria-hidden />{t.footer}</p>
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-muted">
          <span>{t.builtWith}</span>
          <Link prefetch={false} href={`/${lang}/nasa-data`} className="underline-offset-4 hover:text-brand hover:underline">{t.navNasa}</Link>
          <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-brand hover:underline">NASA POWER</a>
          <a href="https://github.com/ELDEEP82/dawra-ai" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-brand hover:underline">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
