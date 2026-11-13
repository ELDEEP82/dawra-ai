"use client";
/** Bento card system: one header style (icon · title · one-line explanation · actions), error boundary with retry,
 *  and content-shaped skeletons that already show the card title. */
import { Component, type ErrorInfo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { RotateCw } from "lucide-react";

export function CardHeader({ icon: Icon, title, explain, actions }: { icon?: LucideIcon; title: string; explain?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start gap-3">
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand" aria-hidden>
          <Icon size={20} strokeWidth={2} />
        </span>
      )}
      <div className="min-w-[13rem] flex-1">
        <h3 className="text-base font-semibold leading-snug text-ink sm:text-lg">{title}</h3>
        {explain && <p className="mt-0.5 max-w-[70ch] text-sm text-muted">{explain}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode; label: string }, { error: Error | null; key: number }> {
  state = { error: null as Error | null, key: 0 };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.warn("section failed", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-canvas p-6 text-center text-sm text-muted">
          <span>{this.props.label}</span>
          <button onClick={() => this.setState((s) => ({ error: null, key: s.key + 1 }))} className="btn-ghost min-h-[40px] gap-2 px-4">
            <RotateCw size={16} aria-hidden /> Retry · إعادة المحاولة
          </button>
        </div>
      );
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}

export function ErrorBoundary({ children, label = "This part did not load. · الجزء ده ماتحمّلش." }: { children: ReactNode; label?: string }) {
  return <Boundary label={label}>{children}</Boundary>;
}

export function Card({ icon, title, explain, actions, children, className = "", bodyClass = "", id }: {
  icon?: LucideIcon; title: string; explain?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string;
}) {
  return (
    <section id={id} className={`card min-w-0 scroll-mt-32 p-5 sm:p-6 ${className}`} aria-label={title}>
      <CardHeader icon={icon} title={title} explain={explain} actions={actions} />
      <ErrorBoundary>
        <div className={bodyClass}>{children}</div>
      </ErrorBoundary>
    </section>
  );
}

/** Skeleton that keeps the card frame and title so the layout never jumps. */
export function CardSkeleton({ icon, title, explain, height = 240, className = "" }: { icon?: LucideIcon; title: string; explain?: string; height?: number; className?: string }) {
  return (
    <section className={`card min-w-0 p-5 sm:p-6 ${className}`} aria-busy="true" aria-label={title}>
      <CardHeader icon={icon} title={title} explain={explain} />
      <div className="shimmer rounded-2xl" style={{ height }} aria-hidden />
    </section>
  );
}

export function Shimmer({ height = 240, className = "" }: { height?: number; className?: string }) {
  return <div className={`shimmer rounded-2xl ${className}`} style={{ height }} aria-hidden />;
}
