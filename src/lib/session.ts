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

async function currentPath() {
  const path = (await headers()).get("x-pathname");
  return path && path.startsWith("/") && !path.startsWith("//") && !/^\/(entrar|onboarding|continuar|auth)/.test(path) ? path : undefined;
}

export async function requireUser(roles?: Role[], options?: { allowIncomplete?: boolean; nextPath?: string }) {
  const stored = await getAuthenticatedUser();
  const nextPath = options?.nextPath ?? await currentPath();
  if (!stored) redirect(nextPath ? "/entrar?next=" + encodeURIComponent(nextPath) : "/entrar");
  // Accounts with 2FA must complete the code before any protected page, whatever path led here.
  // Read from the already verified session cookie, so no extra request to Supabase Auth.
  const { data: assurance } = await (await getRequestSupabase()).auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") redirect(nextPath ? "/mfa?next=" + encodeURIComponent(nextPath) : "/mfa");
  if (roles && !roles.includes(stored.role)) redirect(stored.role === Role.CONSULTANT ? "/consultor" : "/dashboard");
  if (!options?.allowIncomplete && !stored.onboardingCompleted) redirect(nextPath ? "/onboarding?next=" + encodeURIComponent(nextPath) : "/onboarding");
  return stored;
}
