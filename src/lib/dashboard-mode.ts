import "server-only";
import { cookies } from "next/headers";

// The menu a consultant was using last (set by RememberDashboardMode in the browser). Pages that
// both modes can open (support, a booking) keep that menu instead of switching by account type.
export const DASHBOARD_MODE_COOKIE = "insidely-mode";

export async function preferredDashboardMode(role: string): Promise<"consultant" | "user"> {
  if (role !== "CONSULTANT") return "user";
  return (await cookies()).get(DASHBOARD_MODE_COOKIE)?.value === "user" ? "user" : "consultant";
}

// The panel menu last shown in this browser (RememberDashboardMode), for loading screens of a full page
// load. In-app navigation uses the exact copy of the sidebar on screen instead (PanelLoading).
export async function lastPanel(): Promise<{ mode: "user" | "consultant" | "admin" | "support"; canConsultant: boolean }> {
  const value = (await cookies()).get("insidely-panel")?.value ?? "";
  if (value === "consultant" || value === "admin" || value === "support") return { mode: value, canConsultant: value === "consultant" };
  return { mode: "user", canConsultant: value === "user-c" };
}
