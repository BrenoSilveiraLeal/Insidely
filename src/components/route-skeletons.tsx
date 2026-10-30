import { DashboardShell } from "@/components/dashboard-shell";
import { PublicShell } from "@/components/public-shell";
import { Suspense } from "react";
import { SkeletonForMode } from "@/components/dashboard-mode";

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

/** Loading for pages a consultant also opens: keeps whichever menu (client or consultant) is in use. */
export function SharedDashboardSkeleton({ useContext = false }: { useContext?: boolean }) {
  const user = <DashboardSkeleton mode="user" />;
  return <Suspense fallback={user}><SkeletonForMode useContext={useContext} user={user} consultant={<DashboardSkeleton mode="consultant" />} /></Suspense>;
}

/** Public page loading: same header and dark hero as the pages, with placeholders where content lands. */
export function PageSkeleton() {
  return <PublicShell>
    <section className="page-hero skeleton-hero" aria-busy="true" aria-label="Carregando"><div className="container page-hero-inner"><Block className="skeleton-line skeleton-line-short skeleton-on-dark" /><Block className="skeleton-title skeleton-on-dark" /><Block className="skeleton-line skeleton-on-dark" /></div></section>
    <section className="section"><div className="container grid grid-3"><Block className="skeleton-card" /><Block className="skeleton-card" /><Block className="skeleton-card" /></div></section>
  </PublicShell>;
}
