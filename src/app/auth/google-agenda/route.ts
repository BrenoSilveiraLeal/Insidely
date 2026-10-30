import { NextRequest, NextResponse } from "next/server";
import { agendaSyncCallbackUrl, GOOGLE_FREEBUSY_SCOPE } from "@/lib/google-agenda-sync";
import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Starts "Sincronizar com o Google Agenda" (see google-agenda-sync.ts); finished in /auth/callback.
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "CONSULTANT") return NextResponse.redirect(new URL("/entrar?next=%2Fconsultor%2Fagenda", request.url));
  const supabase = await createSupabaseServerClient();
  const options = { redirectTo: agendaSyncCallbackUrl(user.id), scopes: GOOGLE_FREEBUSY_SCOPE, queryParams: { prompt: "consent", login_hint: user.email ?? "" } };
  const { data: identityData } = await supabase.auth.getUserIdentities();
  const hasGoogleIdentity = identityData?.identities?.some((identity) => identity.provider === "google") ?? false;
  const { data, error } = hasGoogleIdentity
    ? await supabase.auth.signInWithOAuth({ provider: "google", options })
    : await supabase.auth.linkIdentity({ provider: "google", options });
  if (error || !data.url) return NextResponse.redirect(new URL("/consultor/agenda?sync=connect-error", request.url));
  return NextResponse.redirect(data.url);
}
