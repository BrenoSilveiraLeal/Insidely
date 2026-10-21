import { NextRequest, NextResponse } from "next/server";
import { readEmailChangeToken } from "@/lib/email-change-token";
import { sendEmailChangedNotice } from "@/lib/email";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const settings = (request: NextRequest, status: string) => NextResponse.redirect(new URL(`/dashboard/configuracoes?email=${status}`, request.url));

// Completes an e-mail change requested in the account settings. Requires the same signed-in account,
// so a forwarded or intercepted link alone cannot move someone else's account.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("token") ?? "";
  const claim = readEmailChangeToken(raw);
  if (!claim) return settings(request, "link_invalido");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(`/auth/email-change?token=${raw}`)}`, request.url));
  if (user.id !== claim.uid) return settings(request, "outra_conta");
  if (user.email?.toLowerCase() !== claim.from) return settings(request, "link_invalido");

  const service = createSupabaseServiceClient();
  const { error } = await service.auth.admin.updateUserById(user.id, { email: claim.to, email_confirm: true });
  if (error) return settings(request, /already|exists|registered/i.test(`${error.code} ${error.message}`) ? "em_uso" : "erro");
  const { error: profileError } = await service.from("User").update({ email: claim.to, updatedAt: new Date().toISOString() }).eq("auth_user_id", user.id);
  if (profileError) {
    // Keep login and profile consistent: undo the Auth change if the profile could not follow.
    await service.auth.admin.updateUserById(user.id, { email: claim.from, email_confirm: true });
    return settings(request, "erro");
  }
  // Refresh the session so the new address shows up right away.
  await supabase.auth.refreshSession();
  try { await sendEmailChangedNotice({ to: claim.from, newEmail: claim.to }); } catch (mailError) { console.error("email_changed_notice_failed", mailError); }
  return settings(request, "alterado");
}
