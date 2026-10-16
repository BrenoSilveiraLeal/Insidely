import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionAppUser } from "@/lib/provision-user";

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
    const result = await provisionAppUser(user);
    if (result.status === "conflict") return NextResponse.redirect(new URL("/entrar?social=conta_existente", request.url));
    if (result.status === "linking") return NextResponse.redirect(new URL("/entrar?social=vinculacao", request.url));
    if (result.status !== "ok") return NextResponse.redirect(new URL("/entrar?social=profile", request.url));
    return NextResponse.redirect(new URL(result.profile.onboardingCompleted ? nextPath : "/onboarding", request.url));
  } catch { return NextResponse.redirect(new URL("/entrar?social=error", request.url)); }
}
