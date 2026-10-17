import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calendarReturnPath, googleCalendarCallbackUrl, GOOGLE_CALENDAR_SCOPE } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("bookingId")?.trim();
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.redirect(new URL("/entrar?next=%2Fdashboard%2Fagendamentos", request.url));
  const returnTo = calendarReturnPath(request.nextUrl.searchParams.get("returnTo"), user.role);
  if (!bookingId || bookingId.length > 100) return NextResponse.redirect(new URL(`${returnTo}?calendar=error`, request.url));

  const supabase = await createSupabaseServerClient();
  const options = {
    redirectTo: googleCalendarCallbackUrl(bookingId, user.id, returnTo),
    scopes: GOOGLE_CALENDAR_SCOPE,
    queryParams: { access_type: "offline", prompt: "consent", login_hint: user.email ?? "" },
  };
  const { data: identityData } = await supabase.auth.getUserIdentities();
  const hasGoogleIdentity = identityData?.identities?.some((identity) => identity.provider === "google") ?? false;
  const { data, error } = hasGoogleIdentity
    ? await supabase.auth.signInWithOAuth({ provider: "google", options })
    : await supabase.auth.linkIdentity({ provider: "google", options });
  if (error || !data.url) return NextResponse.redirect(new URL(`${returnTo}?calendar=connect-error`, request.url));
  return NextResponse.redirect(data.url);
}
