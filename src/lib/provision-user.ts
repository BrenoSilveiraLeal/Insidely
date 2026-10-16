import type { User as AuthUser } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ProvisionResult =
  | { status: "ok"; profile: { id: string; onboardingCompleted: boolean } }
  | { status: "conflict" | "linking" | "error" };

// Creates (or refreshes) the application User row for an authenticated Supabase identity.
// Runs after OAuth/email-link callbacks and on the first password login, so accounts whose
// confirmation link was never opened in this app still get a profile.
export async function provisionAppUser(user: AuthUser): Promise<ProvisionResult> {
  if (!user.email) return { status: "error" };
  const name = user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim() || "Pessoa Insidely";
  const image = user.user_metadata?.avatar_url || null;
  const service = createSupabaseServiceClient();
  const email = user.email.toLowerCase();
  let { data: profile, error: profileError } = await service.from("User").select("id, name, image, role, onboardingCompleted").eq("auth_user_id", user.id).maybeSingle();
  // Never bind an identity to an existing profile by email alone.
  // Account linking must happen from an authenticated, explicit flow.
  if (!profile && !profileError) {
    const byEmail = await service.from("User").select("id, auth_user_id").eq("email", email).maybeSingle();
    if (byEmail.error) profileError = byEmail.error;
    else if (byEmail.data?.auth_user_id) return { status: "conflict" };
    else if (byEmail.data) return { status: "linking" };
  }
  if (profile) {
    const update = await service.from("User").update({ auth_user_id: user.id, name: profile.name || name, image: profile.image || image, updatedAt: new Date().toISOString() }).eq("id", profile.id);
    profileError = update.error;
  } else if (!profileError) {
    const created = await service.from("User").insert({ id: crypto.randomUUID(), name, email, image, auth_user_id: user.id, updatedAt: new Date().toISOString() }).select("id, name, image, role, onboardingCompleted").single();
    profile = created.data;
    profileError = created.error;
    // A concurrent request created the row first (unique violation): use that one.
    if (created.error?.code === "23505") ({ data: profile, error: profileError } = await service.from("User").select("id, name, image, role, onboardingCompleted").eq("auth_user_id", user.id).maybeSingle());
  }
  if (profileError || !profile) return { status: "error" };
  return { status: "ok", profile: { id: profile.id, onboardingCompleted: profile.onboardingCompleted } };
}
