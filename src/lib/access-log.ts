import "server-only";
import { cookies, headers } from "next/headers";
import { sendSecurityEmail } from "@/lib/email";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const DEVICE_COOKIE = "insidely_device";

function deviceLabel(userAgent: string) {
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "navegador";
  const system = /Windows/.test(userAgent) ? "Windows" : /Android/.test(userAgent) ? "Android" : /iPhone|iPad/.test(userAgent) ? "iPhone/iPad" : /Mac OS/.test(userAgent) ? "Mac" : /Linux/.test(userAgent) ? "Linux" : "";
  return system ? `${browser} no ${system}` : browser;
}

// Every sign-in is recorded with date, time and IP (Marco Civil da Internet, art. 15: kept for six
// months, purged by the daily job). A browser without the device cookie gets a "new access" e-mail.
export async function recordAccess(authUserId: string, method: "password" | "google" | "oauth" | "email_link") {
  try {
    const list = await headers();
    const ip = (list.get("x-forwarded-for")?.split(",")[0] || list.get("x-real-ip") || "").trim() || null;
    const userAgent = (list.get("user-agent") ?? "").slice(0, 300);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseServiceClient() as any;
    const { data: user } = await supabase.from("User").select("id, name, email").eq("auth_user_id", authUserId).maybeSingle();
    await supabase.from("AccessLog").insert({ userId: user?.id ?? null, authUserId, ip, userAgent, method });
    const jar = await cookies();
    const known = jar.get(DEVICE_COOKIE)?.value === authUserId;
    jar.set(DEVICE_COOKIE, authUserId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    // Only for accounts that already had an earlier sign-in: the very first one is not "new".
    if (!known && user?.email) {
      const { count } = await supabase.from("AccessLog").select("id", { count: "exact", head: true }).eq("authUserId", authUserId);
      if ((count ?? 0) > 1) await sendSecurityEmail(user.email, user.name, "new_device", { when: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }), device: deviceLabel(userAgent) });
    }
  } catch (error) {
    console.error("access_log_failed", { error });
  }
}
