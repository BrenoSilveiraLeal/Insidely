import { DashboardShell } from "@/components/dashboard-shell";
import { PublicShell } from "@/components/public-shell";
import { PanelLoading } from "@/components/dashboard-mode";
import { lastPanel } from "@/lib/dashboard-mode";

function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

function PanelBlocks() {
  return <div className="skeleton-stack" aria-busy="true" aria-label="Carregando">
    <div className="grid grid-3"><Block className="skeleton-metric" /><Block className="skeleton-metric" /><Block className="skeleton-metric" /></div>
    <Block className="skeleton-line skeleton-line-short" />
    <Block className="skeleton-row" /><Block className="skeleton-row" /><Block className="skeleton-row" />
  </div>;
}

/** Panel loading: the sidebar stays exactly as it was on screen (PanelLoading); only the content shows placeholders.
 *  On a full page load there is no sidebar on screen yet, so the menu last used in this browser is shown,
 *  limited to what the area allows (/consultor is always the consultant menu, /admin always a staff one). */
export async function PanelSkeleton({ area }: { area: "consultant" | "staff" | "shared" }) {
  const last = await lastPanel();
  const mode = area === "consultant" ? "consultant" : area === "staff" ? (last.mode === "support" ? "support" : "admin") : last.mode;
  return <PanelLoading fallback={<DashboardShell skeleton mode={mode} canConsultant={last.canConsultant} title=""><PanelBlocks /></DashboardShell>}><PanelBlocks /></PanelLoading>;
}

/** Public page loading: same header and dark hero as the pages, with placeholders where content lands. */
export function PageSkeleton() {
  return <PublicShell>
    <section className="page-hero skeleton-hero" aria-busy="true" aria-label="Carregando"><div className="container page-hero-inner"><Block className="skeleton-line skeleton-line-short skeleton-on-dark" /><Block className="skeleton-title skeleton-on-dark" /><Block className="skeleton-line skeleton-on-dark" /></div></section>
    <section className="section"><div className="container grid grid-3"><Block className="skeleton-card" /><Block className="skeleton-card" /><Block className="skeleton-card" /></div></section>
  </PublicShell>;
}
