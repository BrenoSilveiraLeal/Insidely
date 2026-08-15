import { PremiumNavigation } from "@/components/premium-navigation";
import { getAuthenticatedUser } from "@/lib/session";

export async function SiteHeader() {
  let dashboardHref: string | null = null;
  try { const user = await getAuthenticatedUser(); if (user) dashboardHref = user.role === "ADMIN" ? "/admin" : user.role === "CONSULTANT" ? "/consultor" : "/dashboard"; } catch { dashboardHref = null; }
  return <PremiumNavigation dashboardHref={dashboardHref}/>;
}
