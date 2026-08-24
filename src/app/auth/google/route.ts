import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/continuar";
  return raw;
}

export async function GET(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.redirect(new URL("/entrar?social=config", request.url));
  }
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
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
