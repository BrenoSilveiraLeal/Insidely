import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { createGoogleLoginRequest, GOOGLE_LOGIN_COOKIE, googleLoginConfig } from "@/lib/google-login";

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/continuar";
  return raw;
}

export async function GET(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.redirect(new URL("/entrar?social=config", request.url));
  }
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  // Preferred flow: Google returns to this site (see google-login.ts). Without the login client
  // configured, fall back to Supabase's hosted OAuth below.
  const config = googleLoginConfig();
  if (config) {
    const login = createGoogleLoginRequest(config.clientId, new URL("/auth/google/callback", getAppUrl(request.nextUrl.origin)).toString());
    const response = NextResponse.redirect(login.url);
    response.cookies.set(GOOGLE_LOGIN_COOKIE, JSON.stringify({ state: login.state, nonce: login.nonce, next: nextPath }), { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/auth/google", maxAge: 600 });
    return response;
  }
  const redirectTo = new URL("/auth/callback", getAppUrl(request.nextUrl.origin));
  redirectTo.searchParams.set("next", nextPath);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url) {
      return NextResponse.redirect(new URL("/entrar?social=callback", request.url));
    }
    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(new URL("/entrar?social=callback", request.url));
  }
}
