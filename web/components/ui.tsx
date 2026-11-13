"use client";
/** Small shared UI pieces: animated counter, robustness ring, scroll reveal, skeleton, dataset chip. */
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt } from "@/lib/i18n";

export function Counter({ value, nd = 0, prefix = "", suffix = "", duration = 1.4 }: { value: number; nd?: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [v, setV] = useState(0); // same on server and client (no hydration mismatch)
  useEffect(() => {
    if (reduce) {
      setV(value);
      return;
    }
    if (!inView) return;
    const c = animate(0, value, { duration, ease: "easeOut", onUpdate: setV });
    return () => c.stop();
  }, [inView, value, duration, reduce]);
  return (
    <span ref={ref} className="tabular-nums" dir="ltr">
      {prefix}
      {fmt(v, nd)}
      {suffix}
    </span>
  );
}

/** Smoothly animates to a changing number (what-if lab). */
export function Tween({ value, nd = 0, suffix = "" }: { value: number | null | undefined; nd?: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(value ?? 0);
  const prev = useRef(value ?? 0);
  useEffect(() => {
    if (value === null || value === undefined) return;
    if (reduce) {
      setV(value);
      prev.current = value;
      return;
    }
    const c = animate(prev.current, value, { duration: 0.5, ease: "easeOut", onUpdate: setV });
    prev.current = value;
    return () => c.stop();
  }, [value, reduce]);
  if (value === null || value === undefined) return <span>—</span>;
  return (
    <span className="tabular-nums" dir="ltr">
      {fmt(v, nd)}
      {suffix}
    </span>
  );
}

/** Robustness ring (0–100) with label; colour by status, icon in text (never colour alone). */
export function Ring({ pct, size = 64, label }: { pct: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const color = pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#fb7185";
  const icon = pct >= 70 ? "✔" : pct >= 40 ? "▲" : "✖";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "robustness"} ${Math.round(pct)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.1)" strokeWidth={6} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - pct / 100) }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute text-center text-xs font-semibold leading-tight" dir="ltr">
        {Math.round(pct)}%
        <span className="block text-[9px] font-normal" style={{ color }}>
          {icon}
        </span>
      </span>
    </div>
  );
}

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function Skeleton({ className = "h-40" }: { className?: string }) {
  return <div className={`card animate-pulse bg-white/[0.03] ${className}`} aria-hidden />;
}

const DATASET_RE = /(NASA POWER|Landsat|Sentinel-2|SMAP|GPM IMERG|IMERG|MODIS|SRTM|GRACE(?:\/GRACE-FO)?|CMIP6|NEX-GDDP-CMIP6|CERES|MERRA-2|FAO-56|FAO-29|S1|S4|S16)/g;

/** Renders text with NASA dataset names / sources highlighted as chips. */
export function WithChips({ text }: { text: string }) {
  const parts = text.split(DATASET_RE);
  return (
    <>
      {parts.map((p, i) =>
        /^(NASA POWER|Landsat|Sentinel-2|SMAP|GPM IMERG|IMERG|MODIS|SRTM|GRACE.*|CMIP6|NEX-GDDP-CMIP6|CERES|MERRA-2|FAO-56|FAO-29|S1|S4|S16)$/.test(p) ? (
          <span key={i} className="mx-0.5 inline-block rounded-md border border-nasa-cyan/40 bg-nasa-cyan/10 px-1.5 py-px text-[0.8em] font-medium text-nasa-cyan" dir="ltr">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Mounts its children only when scrolled near (keeps first load light; IDs stay on the parent). */
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
      {show ? children : <div className="card h-full animate-pulse bg-white/[0.02]" style={{ minHeight }} aria-hidden />}
    </div>
  );
}
