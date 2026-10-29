import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionAppUser } from "@/lib/provision-user";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// One auth client per request: the header, the page and generateMetadata all share it.
const getRequestSupabase = cache(createSupabaseServerClient);

// getClaims() verifies the session JWT locally against the cached JWKS instead of a round trip
// to Supabase Auth on every render (it only falls back to getUser() for symmetric-key projects).
const getVerifiedAuthUserId = cache(async () => {
  const { data, error } = await (await getRequestSupabase()).auth.getClaims();
  return error || !data?.claims?.sub ? null : data.claims.sub;
});

export const getAuthenticatedUser = cache(async () => {
  const authUserId = await getVerifiedAuthUserId();
  if (authUserId) {
    const supabase = await getRequestSupabase();
    const columns = "id, name, email, image, role, onboardingCompleted";
    let { data: stored, error } = await supabase.from("User").select(columns).eq("auth_user_id", authUserId).maybeSingle();
    // First password login of an account whose confirmation link never reached /auth/callback.
    // Re-read through the service client: Next memoizes identical fetches within a render, so
    // repeating the same query would return the cached "not found". Keyed on the verified auth id.
    if (!stored && !error) {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (supabaseUser) await provisionAppUser(supabaseUser);
      ({ data: stored, error } = await createSupabaseServiceClient().from("User").select(columns).eq("auth_user_id", authUserId).maybeSingle());
    }
    if (stored) return { ...stored, role: stored.role as Role };
    if (error) {
      if (error.message.includes("JWT issued at future")) {
        redirect("/entrar?erro=sessao_expirada");
      }
      throw new Error(`Supabase profile lookup failed: ${error.message}`);
    }
  }
  return null;
});

export type Suspension = { reason: string; until: string | null };

// Suspended accounts are sent to /conta-suspensa before any protected page (admins excepted).
export const getSuspension = cache(async (userId: string): Promise<Suspension | null> => {
  // The suspension columns are added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createSupabaseServiceClient() as any).from("User").select("suspendedAt, suspendedUntil, suspensionReason").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Supabase suspension lookup failed: ${error.message}`);
  if (!data?.suspendedAt || (data.suspendedUntil && new Date(`${String(data.suspendedUntil).replace(" ", "T")}Z`).getTime() <= Date.now())) return null;
  return { reason: data.suspensionReason ?? "", until: data.suspendedUntil };
});

export const hasCustomerIdentity = cache(async () => {
  // has_customer_identity is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await ((await getRequestSupabase()) as any).rpc("has_customer_identity");
  if (error) throw new Error(`Supabase identity lookup failed: ${error.message}`);
  return data === true;
});

async function currentPath() {
  const path = (await headers()).get("x-pathname");
  return path && path.startsWith("/") && !path.startsWith("//") && !/^\/(entrar|onboarding|continuar|identificacao|conta-suspensa|auth)/.test(path) ? path : undefined;
}

export async function requireUser(roles?: Role[], options?: { allowIncomplete?: boolean; allowSuspended?: boolean; nextPath?: string }) {
  const stored = await getAuthenticatedUser();
  const nextPath = options?.nextPath ?? await currentPath();
  if (!stored) redirect(nextPath ? "/entrar?next=" + encodeURIComponent(nextPath) : "/entrar");
  // Accounts with 2FA must complete the code before any protected page, whatever path led here.
  // Read from the already verified session cookie, so no extra request to Supabase Auth.
  const { data: assurance } = await (await getRequestSupabase()).auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") redirect(nextPath ? "/mfa?next=" + encodeURIComponent(nextPath) : "/mfa");
  if (stored.role !== Role.ADMIN && !options?.allowSuspended && await getSuspension(stored.id)) redirect("/conta-suspensa");
  if (roles && !roles.includes(stored.role)) redirect(stored.role === Role.CONSULTANT ? "/consultor" : "/dashboard");
  if (!options?.allowIncomplete && !stored.onboardingCompleted) redirect(nextPath ? "/onboarding?next=" + encodeURIComponent(nextPath) : "/onboarding");
  // Every customer and consultant account registers a CPF; older accounts do it on the next visit.
  if (!options?.allowIncomplete && stored.role !== Role.ADMIN && !await hasCustomerIdentity()) redirect(nextPath ? "/identificacao?next=" + encodeURIComponent(nextPath) : "/identificacao");
  return stored;
}
