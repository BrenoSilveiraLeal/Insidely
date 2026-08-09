import { auth } from "@/auth";
import { PremiumNavigation } from "@/components/premium-navigation";

export async function SiteHeader() {
  let dashboardHref: string | null = null;
  try { const session = await auth(); if (session?.user) dashboardHref = session.user.role === "ADMIN" ? "/admin" : session.user.role === "CONSULTANT" ? "/consultor" : "/dashboard"; } catch { dashboardHref = null; }
  return <PremiumNavigation dashboardHref={dashboardHref}/>;
}
