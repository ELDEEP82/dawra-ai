"use client";
/** Framer-free UI used above the fold (keeps the first load light): counter, lazy section, skeleton,
 *  CSS flip card and magnetic button. Heavier motion lives in ui.tsx and loads with the lazy sections. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt } from "@/lib/i18n";

function prefersReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up once when visible (requestAnimationFrame, ease-out). */
export function Counter({ value, nd = 0, prefix = "", suffix = "", duration = 1400 }: { value: number; nd?: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced()) {
      setV(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / duration);
        setV(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  return (
    <span ref={ref} className="tabular-nums" dir="ltr">
      {prefix}
      {fmt(v, nd)}
      {suffix}
    </span>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`shimmer rounded-card border border-line ${className}`} aria-hidden />;
}

/** Mounts its children only when scrolled near (IDs stay on the parent). */
export function LazySection({ children, minHeight = 320, margin = "250px" }: { children: ReactNode; minHeight?: number; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setShow(true);
        io.disconnect();
      }
    }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [show, margin]);
  return (
    <div ref={ref} style={show ? undefined : { minHeight }}>
      {show ? children : <div className="shimmer h-full rounded-card border border-line" style={{ minHeight }} aria-hidden />}
    </div>
  );
}

/** CSS 3D flip card (no JS animation library): click / Enter / Space; fades under reduced motion. */
export function CssFlip({ front, back, label, className = "" }: { front: ReactNode; back: ReactNode; label: string; className?: string }) {
  const [on, setOn] = useState(false);
  return (
    <div className={`css-flip ${on ? "is-flipped" : ""} ${className}`}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={on}
        onClick={() => setOn((x) => !x)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOn((x) => !x);
          }
        }}
        className="css-flip-inner h-full cursor-pointer rounded-card outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
      >
        <span className="sr-only">{label}</span>
        <div className="css-flip-face h-full" aria-hidden={on}>{front}</div>
        <div className="css-flip-face css-flip-back" aria-hidden={!on}>{back}</div>
      </div>
    </div>
  );
}

/** Magnetic hover (pointer-follow a few px) with plain style transforms. */
export function Magnetic({ children, strength = 10 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      className="inline-flex transition-transform duration-200 ease-out"
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || prefersReduced() || !ref.current) return;
        const r = e.currentTarget.getBoundingClientRect();
        ref.current.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * strength}px, ${((e.clientY - r.top) / r.height - 0.5) * strength}px)`;
      }}
      onPointerLeave={() => {
        if (ref.current) ref.current.style.transform = "";
      }}
    >
      {children}
    </span>
  );
}
