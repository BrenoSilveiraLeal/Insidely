import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSocialSessionToken, SOCIAL_SESSION_COOKIE } from "@/lib/social-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/")) return "/continuar";
  return raw;
}

export async function GET(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.redirect(new URL("/entrar?social=config", request.url));
  }
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(new URL("/entrar?social=callback", request.url));
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(new URL("/entrar?social=callback", request.url));
    }
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user?.email) {
      return NextResponse.redirect(new URL("/entrar?social=callback", request.url));
    }

    const email = data.user.email.toLowerCase();
    const stored = await prisma.user.upsert({
      where: { email },
      update: {
        name: data.user.user_metadata?.full_name?.trim() || data.user.user_metadata?.name?.trim() || undefined,
        image: data.user.user_metadata?.avatar_url || undefined,
      },
      create: {
        email,
        name: data.user.user_metadata?.full_name?.trim() || data.user.user_metadata?.name?.trim() || "Pessoa Insidely",
        image: data.user.user_metadata?.avatar_url || null,
        role: Role.USER,
      },
      select: { id: true, role: true, onboardingCompleted: true },
    });

    const destination = stored.onboardingCompleted
      ? nextPath
      : "/onboarding";
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.set(SOCIAL_SESSION_COOKIE, createSocialSessionToken(stored.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("P1001") || message.includes("Can't reach database server")) {
      return NextResponse.redirect(new URL("/entrar?social=db", request.url));
    }
    return NextResponse.redirect(new URL("/entrar?social=callback", request.url));
  }
}
