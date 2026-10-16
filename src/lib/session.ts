import { redirect } from "next/navigation";
import { Role } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionAppUser } from "@/lib/provision-user";

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (supabaseUser) {
    const lookup = () => supabase.from("User").select("id, name, email, image, role, onboardingCompleted").eq("auth_user_id", supabaseUser.id).maybeSingle();
    let { data: stored, error } = await lookup();
    // First password login of an account whose confirmation link never reached /auth/callback.
    if (!stored && !error && (await provisionAppUser(supabaseUser)).status === "ok") ({ data: stored, error } = await lookup());
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

export async function requireUser(roles?: Role[], options?: { allowIncomplete?: boolean; nextPath?: string }) {
  const stored = await getAuthenticatedUser();
  if (!stored) redirect(options?.nextPath ? "/entrar?next=" + encodeURIComponent(options.nextPath) : "/entrar");
  if (roles && !roles.includes(stored.role)) redirect(stored.role === Role.CONSULTANT ? "/consultor" : "/dashboard");
  if (!options?.allowIncomplete && !stored.onboardingCompleted) redirect("/onboarding");
  return stored;
}
