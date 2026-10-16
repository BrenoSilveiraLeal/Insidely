import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Role } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionAppUser } from "@/lib/provision-user";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (supabaseUser) {
    const columns = "id, name, email, image, role, onboardingCompleted";
    let { data: stored, error } = await supabase.from("User").select(columns).eq("auth_user_id", supabaseUser.id).maybeSingle();
    // First password login of an account whose confirmation link never reached /auth/callback.
    // Re-read through the service client: Next memoizes identical fetches within a render, so
    // repeating the same query would return the cached "not found". Keyed on the verified auth id.
    if (!stored && !error) {
      await provisionAppUser(supabaseUser);
      ({ data: stored, error } = await createSupabaseServiceClient().from("User").select(columns).eq("auth_user_id", supabaseUser.id).maybeSingle());
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
}

async function currentPath() {
  const path = (await headers()).get("x-pathname");
  return path && path.startsWith("/") && !path.startsWith("//") && !/^\/(entrar|onboarding|continuar|auth)/.test(path) ? path : undefined;
}

export async function requireUser(roles?: Role[], options?: { allowIncomplete?: boolean; nextPath?: string }) {
  const stored = await getAuthenticatedUser();
  const nextPath = options?.nextPath ?? await currentPath();
  if (!stored) redirect(nextPath ? "/entrar?next=" + encodeURIComponent(nextPath) : "/entrar");
  // Accounts with 2FA must complete the code before any protected page, whatever path led here.
  const { data: assurance } = await (await createSupabaseServerClient()).auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") redirect(nextPath ? "/mfa?next=" + encodeURIComponent(nextPath) : "/mfa");
  if (roles && !roles.includes(stored.role)) redirect(stored.role === Role.CONSULTANT ? "/consultor" : "/dashboard");
  if (!options?.allowIncomplete && !stored.onboardingCompleted) redirect(nextPath ? "/onboarding?next=" + encodeURIComponent(nextPath) : "/onboarding");
  return stored;
}
