import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type Kind = "signup" | "recovery" | "email_change";

// Per address: a few e-mails per 15 minutes is plenty for a real person. Per IP: stops bulk abuse.
const ADDRESS_LIMIT = 3, IP_LIMIT = 10, WINDOW_SECONDS = 15 * 60;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function clientIp() {
  const list = await headers();
  return (list.get("x-forwarded-for")?.split(",")[0] || list.get("x-real-ip") || "").trim();
}

/** True when another account e-mail may be sent. Keys are hashed, so no address or IP is stored in clear. */
export async function allowAuthEmail(kind: Kind, email: string) {
  try {
    const service = createSupabaseServiceClient();
    const ip = await clientIp();
    const checks = [service.rpc("consume_auth_email_quota", { p_key: hash(`${kind}:email:${email.toLowerCase()}`), p_limit: ADDRESS_LIMIT, p_window_seconds: WINDOW_SECONDS })];
    if (ip) checks.push(service.rpc("consume_auth_email_quota", { p_key: hash(`auth-email:ip:${ip}`), p_limit: IP_LIMIT, p_window_seconds: WINDOW_SECONDS }));
    const results = await Promise.all(checks);
    const failed = results.find((result) => result.error);
    // Fail open: a missing migration or a database hiccup must not block sign-up and recovery.
    if (failed?.error) { console.error("auth_email_throttle_unavailable", failed.error.message); return true; }
    return results.every((result) => result.data === true);
  } catch (error) {
    console.error("auth_email_throttle_unavailable", error);
    return true;
  }
}

// CPF registration: "this CPF is already in use" would otherwise let someone test many CPFs to learn
// which are registered. A real person needs one or two tries. Uses the same quota table.
export async function allowIdentityAttempt(userId: string) {
  try {
    const service = createSupabaseServiceClient();
    const ip = await clientIp();
    const checks = [service.rpc("consume_auth_email_quota", { p_key: hash(`identity:user:${userId}`), p_limit: 5, p_window_seconds: 60 * 60 })];
    if (ip) checks.push(service.rpc("consume_auth_email_quota", { p_key: hash(`identity:ip:${ip}`), p_limit: 15, p_window_seconds: 60 * 60 }));
    const results = await Promise.all(checks);
    const failed = results.find((result) => result.error);
    if (failed?.error) { console.error("identity_throttle_unavailable", failed.error.message); return true; }
    return results.every((result) => result.data === true);
  } catch (error) {
    console.error("identity_throttle_unavailable", error);
    return true;
  }
}
