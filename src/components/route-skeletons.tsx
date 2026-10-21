import { DashboardShell } from "@/components/dashboard-shell";
import { PublicShell } from "@/components/public-shell";

function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Dashboard loading: the real sidebar and header stay put; only the content area shows placeholders. */
export function DashboardSkeleton({ mode }: { mode: "user" | "consultant" | "admin" }) {
  return <DashboardShell mode={mode} title="">
    <div className="skeleton-stack" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-3"><Block className="skeleton-metric" /><Block className="skeleton-metric" /><Block className="skeleton-metric" /></div>
      <Block className="skeleton-line skeleton-line-short" />
      <Block className="skeleton-row" /><Block className="skeleton-row" /><Block className="skeleton-row" />
    </div>
  </DashboardShell>;
}

/** Public page loading: same header and dark hero as the pages, with placeholders where content lands. */
export function PageSkeleton() {
  return <PublicShell>
    <section className="page-hero skeleton-hero" aria-busy="true" aria-label="Carregando"><div className="container page-hero-inner"><Block className="skeleton-line skeleton-line-short skeleton-on-dark" /><Block className="skeleton-title skeleton-on-dark" /><Block className="skeleton-line skeleton-on-dark" /></div></section>
    <section className="section"><div className="container grid grid-3"><Block className="skeleton-card" /><Block className="skeleton-card" /><Block className="skeleton-card" /></div></section>
  </PublicShell>;
}
