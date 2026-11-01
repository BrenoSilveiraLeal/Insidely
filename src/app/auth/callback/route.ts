import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { provisionAppUser } from "@/lib/provision-user";
import { recordAccess } from "@/lib/access-log";
import { calendarReturnPath, createParticipantCalendarEvent, recordGoogleError } from "@/lib/google-calendar";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { calendarLinkReturnPath } from "@/lib/google-agenda-sync";
import { saveCalendarLink, syncCalendar } from "@/lib/google-calendar-link";

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
    const agendaSyncFlow = nextUrl.pathname === "/auth/google-agenda/complete";
    if (agendaSyncFlow) {
      const agendaReturn = calendarLinkReturnPath(nextUrl.searchParams.get("returnTo"), true);
      const { data: existingUser } = await createSupabaseServiceClient().from("User").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (!existingUser || existingUser.id !== nextUrl.searchParams.get("userId")) { await supabase.auth.signOut(); return NextResponse.redirect(new URL(`${agendaReturn}?sync=account-mismatch`, request.url)); }
      // The refresh token keeps the link: without it (offline access refused) nothing can stay in sync.
      const refreshToken = exchange.session?.provider_refresh_token;
      if (!refreshToken) { await recordGoogleError("google-calendar-link", "no provider_refresh_token"); return NextResponse.redirect(new URL(`${agendaReturn}?sync=permission-error`, request.url)); }
      const googleEmail = (user.identities?.find((identity) => identity.provider === "google")?.identity_data?.email as string | undefined) ?? user.email ?? null;
      try {
        await saveCalendarLink(existingUser.id, refreshToken, googleEmail);
        const synced = await syncCalendar(existingUser.id);
        return NextResponse.redirect(new URL(`${agendaReturn}?sync=ok&adicionadas=${synced.added}&removidos=${synced.removedSlots}`, request.url));
      } catch (syncError) {
        const reason = syncError instanceof Error ? syncError.message : "";
        return NextResponse.redirect(new URL(`${agendaReturn}?sync=${reason.includes("calendar_link_save_failed") ? "error" : reason === "calendar_api_disabled" ? "api-disabled" : reason === "calendar_permission_missing" ? "permission-error" : "linked-later"}`, request.url));
      }
    }
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
    if (!calendarFlow) await recordAccess(user.id, "oauth");

    if (calendarFlow) {
      const returnTo = calendarReturnPath(nextUrl.searchParams.get("returnTo"));
      const bookingId = nextUrl.searchParams.get("bookingId") ?? "";
      if (!exchange.session?.provider_token) { await recordGoogleError("google-calendar-event", "no provider_token"); return NextResponse.redirect(new URL(`${returnTo}?calendar=permission-error`, request.url)); }
      try {
        await createParticipantCalendarEvent({ userId: result.profile.id, bookingId, accessToken: exchange.session.provider_token });
        return NextResponse.redirect(new URL(`${returnTo}?calendar=added`, request.url));
      } catch (calendarError) {
        await recordGoogleError("google-calendar-event", calendarError instanceof Error ? calendarError.message : String(calendarError));
        const status = calendarError instanceof Error && calendarError.message === "calendar_permission_missing" ? "permission-error" : "error";
        return NextResponse.redirect(new URL(`${returnTo}?calendar=${status}`, request.url));
      }
    }
    return NextResponse.redirect(new URL(result.profile.onboardingCompleted ? nextPath : "/onboarding", request.url));
  } catch { return NextResponse.redirect(new URL("/entrar?social=error", request.url)); }
}
