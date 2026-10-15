import { redirect } from "next/navigation";
import { Role } from "@/lib/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  if (supabaseUser) {
    const { data: stored, error } = await supabase.from("User").select("id, name, email, image, role, onboardingCompleted").eq("auth_user_id", supabaseUser.id).maybeSingle();
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
