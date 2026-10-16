import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionAppUser } from "@/lib/provision-user";
import { calendarReturnPath, createParticipantCalendarEvent } from "@/lib/google-calendar";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export function safeNextPath(raw: string | null) { return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/continuar"; }

export async function GET(request: NextRequest) {
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return NextResponse.redirect(new URL("/entrar?social=config", request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/entrar?social=error", request.url));
  try {
    const supabase = await createSupabaseServerClient();
    const { data: exchange, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return NextResponse.redirect(new URL("/entrar?social=error", request.url));
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) return NextResponse.redirect(new URL("/entrar?social=error", request.url));
    if (nextPath === "/redefinir-senha") return NextResponse.redirect(new URL(nextPath, request.url));
    const nextUrl = new URL(nextPath, request.url);
    const calendarFlow = nextUrl.pathname === "/auth/google-calendar/complete";
    if (calendarFlow) {
      const expectedUserId = nextUrl.searchParams.get("userId");
      const { data: existingUser } = await createSupabaseServiceClient().from("User").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (!expectedUserId || existingUser?.id !== expectedUserId) {
        await supabase.auth.signOut();
        const returnTo = calendarReturnPath(nextUrl.searchParams.get("returnTo"));
        return NextResponse.redirect(new URL(`${returnTo}?calendar=account-mismatch`, request.url));
      }
    }
    const result = await provisionAppUser(user);
    if (result.status === "conflict") return NextResponse.redirect(new URL("/entrar?social=conta_existente", request.url));
    if (result.status === "linking") return NextResponse.redirect(new URL("/entrar?social=vinculacao", request.url));
    if (result.status !== "ok") return NextResponse.redirect(new URL("/entrar?social=profile", request.url));

    if (calendarFlow) {
      const returnTo = calendarReturnPath(nextUrl.searchParams.get("returnTo"));
      const bookingId = nextUrl.searchParams.get("bookingId") ?? "";
      if (!exchange.session?.provider_token) return NextResponse.redirect(new URL(`${returnTo}?calendar=permission-error`, request.url));
      try {
        await createParticipantCalendarEvent({ userId: result.profile.id, bookingId, accessToken: exchange.session.provider_token });
        return NextResponse.redirect(new URL(`${returnTo}?calendar=added`, request.url));
      } catch (calendarError) {
        const status = calendarError instanceof Error && calendarError.message === "calendar_permission_missing" ? "permission-error" : "error";
        return NextResponse.redirect(new URL(`${returnTo}?calendar=${status}`, request.url));
      }
    }
    return NextResponse.redirect(new URL(result.profile.onboardingCompleted ? nextPath : "/onboarding", request.url));
  } catch { return NextResponse.redirect(new URL("/entrar?social=error", request.url)); }
}
