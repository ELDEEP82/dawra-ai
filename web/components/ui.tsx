"use client";
/** Small shared UI pieces: animated counter, robustness ring, scroll reveal, skeleton, dataset chip. */
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
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
  const color = pct >= 70 ? "#2BB673" : pct >= 40 ? "#E8A23A" : "#E5533D";
  const icon = pct >= 70 ? "✔" : pct >= 40 ? "▲" : "✖";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "robustness"} ${Math.round(pct)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(20,32,27,.08)" strokeWidth={6} fill="none" />
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
  return <div className={`shimmer rounded-card border border-line ${className}`} aria-hidden />;
}

const DATASET_RE = /(NASA POWER|Landsat|Sentinel-2|SMAP|GPM IMERG|IMERG|MODIS|SRTM|GRACE(?:\/GRACE-FO)?|CMIP6|NEX-GDDP-CMIP6|CERES|MERRA-2|FAO-56|FAO-29|S1|S4|S16)/g;

/** Renders text with NASA dataset names / sources highlighted as chips. */
export function WithChips({ text }: { text: string }) {
  const parts = text.split(DATASET_RE);
  return (
    <>
      {parts.map((p, i) =>
        /^(NASA POWER|Landsat|Sentinel-2|SMAP|GPM IMERG|IMERG|MODIS|SRTM|GRACE.*|CMIP6|NEX-GDDP-CMIP6|CERES|MERRA-2|FAO-56|FAO-29|S1|S4|S16)$/.test(p) ? (
          <span key={i} className="mx-0.5 inline-block rounded-full border border-brand/25 bg-brand-soft px-2 py-px text-[0.78em] font-semibold text-brand" dir="ltr">
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
      {show ? children : <div className="shimmer h-full rounded-card border border-line" style={{ minHeight }} aria-hidden />}
    </div>
  );
}



/** prefers-reduced-motion, but only after mount — first render matches the server (no hydration mismatch). */
export function useReducedAfterMount(): boolean {
  const reduce = useReducedMotion();
  const [v, setV] = useState(false);
  useEffect(() => setV(!!reduce), [reduce]);
  return v;
}

/** 3D flip card: front/back faces, spring flip on click/Enter/Space, hover tilt with glare; fades when motion is reduced. */
export function FlipCard({ front, back, label, className = "", flipped: controlled, onFlip, backScroll = true }: {
  front: ReactNode; back: ReactNode; label: string; className?: string; flipped?: boolean; onFlip?: (f: boolean) => void; backScroll?: boolean;
}) {
  const reduce = useReducedAfterMount();
  const [own, setOwn] = useState(false);
  const flipped = controlled ?? own;
  const [rtl, setRtl] = useState(false);
  useEffect(() => setRtl(document.documentElement.dir === "rtl"), []);
  const rx = useMotionValue(0), ry = useMotionValue(0), gx = useMotionValue(50), gy = useMotionValue(50);
  const srx = useSpring(rx, { stiffness: 180, damping: 18 }), sry = useSpring(ry, { stiffness: 180, damping: 18 });
  const glare = useTransform([gx, gy], ([x, y]) => `radial-gradient(420px circle at ${x}% ${y}%, rgba(255,255,255,.55), transparent 45%)`);
  const toggle = () => {
    const f = !flipped;
    if (controlled === undefined) setOwn(f);
    onFlip?.(f);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 8);
    rx.set(-(py - 0.5) * 6);
    gx.set(px * 100);
    gy.set(py * 100);
  };
  const reset = () => { rx.set(0); ry.set(0); };
  const dir = rtl ? -180 : 180;
  return (
    <motion.div className={`flip-scene group ${className}`} style={{ rotateX: srx, rotateY: sry }} onPointerMove={onMove} onPointerLeave={reset}>
      <div
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,[data-noflip]")) return;
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        className="h-full cursor-pointer rounded-card outline-none focus-visible:ring-4 focus-visible:ring-brand/30"
      >
        <span className="sr-only">{label}</span>
        {reduce ? (
          <div className="relative h-full">
            <motion.div className="h-full" animate={{ opacity: flipped ? 0 : 1 }} style={{ pointerEvents: flipped ? "none" : "auto" }}>{front}</motion.div>
            <motion.div className={`absolute inset-0 ${backScroll ? "overflow-y-auto" : ""}`} initial={false} animate={{ opacity: flipped ? 1 : 0 }} style={{ pointerEvents: flipped ? "auto" : "none" }} aria-hidden={!flipped}>{back}</motion.div>
          </div>
        ) : (
          <motion.div className="flip-inner h-full" animate={{ rotateY: flipped ? dir : 0 }} transition={{ type: "spring", stiffness: 70, damping: 14, mass: 0.9 }}>
            <div className="flip-face relative h-full" aria-hidden={flipped}>
              {front}
              <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-card opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: glare }} />
            </div>
            <div className={`flip-face flip-back ${backScroll ? "overflow-y-auto" : ""} rounded-card`} aria-hidden={!flipped}>{back}</div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/** Magnetic hover for primary buttons (follows the pointer a few px). */
export function Magnetic({ children, strength = 10 }: { children: ReactNode; strength?: number }) {
  const reduce = useReducedAfterMount();
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 15 }), sy = useSpring(y, { stiffness: 220, damping: 15 });
  return (
    <motion.span
      className="inline-flex"
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== "mouse") return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set(((e.clientX - r.left) / r.width - 0.5) * strength);
        y.set(((e.clientY - r.top) / r.height - 0.5) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.span>
  );
}

/** Segmented tabs with an animated underline (layoutId). */
export function Tabs<T extends string>({ items, value, onChange, id, label }: { items: { key: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; id: string; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-full border border-line bg-paper p-1 shadow-card">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button key={it.key} role="tab" aria-selected={on} onClick={() => onChange(it.key)} className={`relative min-h-[36px] rounded-full px-3 text-xs font-medium transition sm:text-sm ${on ? "text-paper" : "text-slate-300 hover:text-brand"}`}>
            {on && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-full bg-brand" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className="relative z-10 inline-flex items-center gap-1.5">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
