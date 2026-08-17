import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    const { data: profile, error: profileError } = await supabase.rpc("sync_social_profile", { p_name: name, p_image: image }).maybeSingle();
    if (profileError || !profile) return NextResponse.redirect(new URL("/entrar?social=profile", request.url));
    return NextResponse.redirect(new URL(profile.onboardingCompleted ? nextPath : "/onboarding", request.url));
  } catch { return NextResponse.redirect(new URL("/entrar?social=error", request.url)); }
}
