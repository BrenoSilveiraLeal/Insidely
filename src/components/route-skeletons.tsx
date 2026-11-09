import { DashboardShell } from "@/components/dashboard-shell";
import { PublicShell } from "@/components/public-shell";
import { Suspense } from "react";
import { SkeletonForMode, SkeletonForStaff } from "@/components/dashboard-mode";
import { preferredStaffMode, rememberedDashboardMode } from "@/lib/dashboard-mode";

function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Dashboard loading: the real sidebar and header stay put; only the content area shows placeholders. */
export function DashboardSkeleton({ mode }: { mode: "user" | "consultant" | "admin" | "support" }) {
  return <DashboardShell mode={mode} title="">
    <div className="skeleton-stack" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-3"><Block className="skeleton-metric" /><Block className="skeleton-metric" /><Block className="skeleton-metric" /></div>
      <Block className="skeleton-line skeleton-line-short" />
      <Block className="skeleton-row" /><Block className="skeleton-row" /><Block className="skeleton-row" />
    </div>
  </DashboardShell>;
}

/** Loading for pages a consultant also opens: keeps whichever menu (client or consultant) is in use. */
export async function SharedDashboardSkeleton({ useContext = false }: { useContext?: boolean }) {
  const initial = await rememberedDashboardMode();
  const user = <DashboardSkeleton mode="user" />;
  const consultant = <DashboardSkeleton mode="consultant" />;
  return <Suspense fallback={initial === "consultant" ? consultant : user}><SkeletonForMode initial={initial} useContext={useContext} user={user} consultant={consultant} /></Suspense>;
}

/** Loading for /admin pages: admin and support have different menus, so keep the one in use. */
export async function StaffDashboardSkeleton() {
  return <SkeletonForStaff initial={await preferredStaffMode()} admin={<DashboardSkeleton mode="admin" />} support={<DashboardSkeleton mode="support" />} />;
}

/** Public page loading: same header and dark hero as the pages, with placeholders where content lands. */
export function PageSkeleton() {
  return <PublicShell>
    <section className="page-hero skeleton-hero" aria-busy="true" aria-label="Carregando"><div className="container page-hero-inner"><Block className="skeleton-line skeleton-line-short skeleton-on-dark" /><Block className="skeleton-title skeleton-on-dark" /><Block className="skeleton-line skeleton-on-dark" /></div></section>
    <section className="section"><div className="container grid grid-3"><Block className="skeleton-card" /><Block className="skeleton-card" /><Block className="skeleton-card" /></div></section>
  </PublicShell>;
}
