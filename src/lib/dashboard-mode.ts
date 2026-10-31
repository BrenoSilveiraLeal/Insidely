import "server-only";
import { cookies } from "next/headers";

// The menu a consultant was using last (set by RememberDashboardMode in the browser). Pages that
// both modes can open (support, a booking) keep that menu instead of switching by account type.
export const DASHBOARD_MODE_COOKIE = "insidely-mode";

export async function preferredDashboardMode(role: string): Promise<"consultant" | "user"> {
  if (role !== "CONSULTANT") return "user";
  return (await cookies()).get(DASHBOARD_MODE_COOKIE)?.value === "user" ? "user" : "consultant";
}
