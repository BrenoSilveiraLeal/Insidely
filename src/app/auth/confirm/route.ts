import type { EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { provisionAppUser } from "@/lib/provision-user";
import { safeInternalPath } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Confirms sign-up and password-recovery links that the app e-mails itself (token_hash flow).
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeInternalPath(request.nextUrl.searchParams.get("next"));
  if (!tokenHash || !type || !["signup", "recovery", "email"].includes(type)) return NextResponse.redirect(new URL("/entrar?cadastro=link_invalido", request.url));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return NextResponse.redirect(new URL("/entrar?cadastro=link_invalido", request.url));
  if (type === "recovery") return NextResponse.redirect(new URL("/redefinir-senha", request.url));
  const result = await provisionAppUser(data.user);
  if (result.status !== "ok") return NextResponse.redirect(new URL("/entrar?cadastro=link_invalido", request.url));
  return NextResponse.redirect(new URL(result.profile.onboardingCompleted ? nextPath : "/onboarding", request.url));
}
