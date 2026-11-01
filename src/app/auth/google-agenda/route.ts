import { NextRequest, NextResponse } from "next/server";
import { agendaSyncCallbackUrl, calendarLinkReturnPath, GOOGLE_FREEBUSY_SCOPE } from "@/lib/google-agenda-sync";
import { GOOGLE_CALENDAR_SCOPE } from "@/lib/google-calendar";
import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Starts "Conectar Google Agenda" (lib/google-calendar-link.ts): one consent with offline access, so
// the app keeps the link (adds conversations to the calendar; for consultants, also reads busy
// times). Finished in /auth/callback.
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user || (user.role !== "CONSULTANT" && user.role !== "USER")) return NextResponse.redirect(new URL("/entrar?next=%2Fdashboard%2Fconfiguracoes", request.url));
  const returnTo = calendarLinkReturnPath(request.nextUrl.searchParams.get("returnTo"), user.role === "CONSULTANT");
  const supabase = await createSupabaseServerClient();
  const options = { redirectTo: agendaSyncCallbackUrl(user.id, returnTo), scopes: `${GOOGLE_FREEBUSY_SCOPE} ${GOOGLE_CALENDAR_SCOPE}`, queryParams: { access_type: "offline", prompt: "consent", login_hint: user.email ?? "" } };
  const { data: identityData } = await supabase.auth.getUserIdentities();
  const hasGoogleIdentity = identityData?.identities?.some((identity) => identity.provider === "google") ?? false;
  const { data, error } = hasGoogleIdentity
    ? await supabase.auth.signInWithOAuth({ provider: "google", options })
    : await supabase.auth.linkIdentity({ provider: "google", options });
  if (error || !data.url) return NextResponse.redirect(new URL(`${returnTo}?sync=connect-error`, request.url));
  return NextResponse.redirect(data.url);
}
