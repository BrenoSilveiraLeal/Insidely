import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { exchangeGoogleCode, GOOGLE_LOGIN_COOKIE, googleLoginConfig } from "@/lib/google-login";
import { provisionAppUser } from "@/lib/provision-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(raw: unknown) {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/continuar";
}

// Google returns here (see google-login.ts): check the state, trade the code for an ID token and
// open the Supabase session with it, then continue like /auth/callback.
export async function GET(request: NextRequest) {
  const fail = (code: string) => {
    const response = NextResponse.redirect(new URL(`/entrar?social=${code}`, request.url));
    response.cookies.delete({ name: GOOGLE_LOGIN_COOKIE, path: "/auth/google" });
    return response;
  };
  const config = googleLoginConfig();
  if (!config) return fail("config");
  let saved: { state?: string; nonce?: string; next?: string } = {};
  try { saved = JSON.parse(request.cookies.get(GOOGLE_LOGIN_COOKIE)?.value ?? "{}"); } catch { /* treated as missing */ }
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !saved.state || !saved.nonce || request.nextUrl.searchParams.get("state") !== saved.state) return fail(request.nextUrl.searchParams.get("error") === "access_denied" ? "cancelado" : "error");
  try {
    const idToken = await exchangeGoogleCode(code, new URL("/auth/google/callback", getAppUrl(request.nextUrl.origin)).toString(), config);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: saved.nonce });
    if (error || !data.user?.email) { console.error("google_login_id_token_failed", { message: error?.message }); return fail("error"); }
    const result = await provisionAppUser(data.user);
    if (result.status === "conflict") return fail("conta_existente");
    if (result.status === "linking") return fail("vinculacao");
    if (result.status !== "ok") return fail("profile");
    const response = NextResponse.redirect(new URL(result.profile.onboardingCompleted ? safeNextPath(saved.next) : "/onboarding", request.url));
    response.cookies.delete({ name: GOOGLE_LOGIN_COOKIE, path: "/auth/google" });
    return response;
  } catch (error) {
    console.error("google_login_failed", { error });
    return fail("error");
  }
}
