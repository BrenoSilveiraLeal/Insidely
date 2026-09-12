import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export function safeNextPath(raw: string | null) { return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/continuar"; }

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.redirect(new URL("/entrar?social=config", request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/entrar?social=error", request.url));
  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return NextResponse.redirect(new URL("/entrar?social=error", request.url));
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) return NextResponse.redirect(new URL("/entrar?social=error", request.url));
    if (nextPath === "/redefinir-senha") return NextResponse.redirect(new URL(nextPath, request.url));
    const name = user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim() || "Pessoa Insidely";
    const image = user.user_metadata?.avatar_url || null;
    const service = createSupabaseServiceClient();
    const email = user.email.toLowerCase();
    let { data: profile, error: profileError } = await service.from("User").select("id, role, onboardingCompleted").eq("auth_user_id", user.id).maybeSingle();
    // Never bind an OAuth identity to an existing profile by email alone.
    // Account linking must happen from an authenticated, explicit flow.
    if (!profile && !profileError) {
      const byEmail = await service.from("User").select("id, auth_user_id").eq("email", email).maybeSingle();
      if (byEmail.error) {
        profileError = byEmail.error;
      } else if (byEmail.data?.auth_user_id) {
        return NextResponse.redirect(new URL("/entrar?social=conta_existente", request.url));
      } else if (byEmail.data) {
        return NextResponse.redirect(new URL("/entrar?social=vinculacao", request.url));
      }
    }
    if (profile) {
      const update = await service.from("User").update({ auth_user_id: user.id, name, image, updatedAt: new Date().toISOString() }).eq("id", profile.id);
      profileError = update.error;
    } else if (!profileError) {
      const created = await service.from("User").insert({ id: crypto.randomUUID(), name, email, image, auth_user_id: user.id, updatedAt: new Date().toISOString() }).select("id, role, onboardingCompleted").single();
      profile = created.data;
      profileError = created.error;
    }
    if (profileError || !profile) return NextResponse.redirect(new URL("/entrar?social=profile", request.url));
    return NextResponse.redirect(new URL(profile.onboardingCompleted ? nextPath : "/onboarding", request.url));
  } catch { return NextResponse.redirect(new URL("/entrar?social=error", request.url)); }
}
