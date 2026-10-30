import "server-only";
import { sendTransactionalEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

// Daily: consultants who are active, not paused and have no free slot ahead get a reminder (in-app
// and e-mail), at most once a week.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function remindEmptyAgendas(supabase: any, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data: profiles } = await supabase.from("ProfessionalProfile").select("id, userId, emptyAgendaRemindedAt, user:User!ProfessionalProfile_userId_fkey(email, name, auth_user_id)").eq("isActive", true).is("pausedAt", null).limit(500);
  let reminded = 0;
  for (const profile of (profiles ?? []) as { id: string; userId: string; emptyAgendaRemindedAt: string | null; user: { email: string; name: string; auth_user_id: string | null } | null }[]) {
    if (!profile.user?.auth_user_id || (profile.emptyAgendaRemindedAt && profile.emptyAgendaRemindedAt > weekAgo)) continue;
    const { count } = await supabase.from("Availability").select("id", { count: "exact", head: true }).eq("professionalProfileId", profile.id).eq("isBooked", false).gt("startsAt", now.toISOString());
    if (count) continue;
    await supabase.from("ProfessionalProfile").update({ emptyAgendaRemindedAt: now.toISOString() }).eq("id", profile.id);
    await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: profile.userId, title: "Sua agenda está vazia", body: "Sem horários livres, ninguém consegue agendar com você. Abra alguns horários ou use os horários recorrentes.", href: "/consultor/agenda", createdAt: now.toISOString() });
    if (profile.user.email) await sendTransactionalEmail({ to: profile.user.email, subject: "Sua agenda na Insidely está vazia", html: `<p>Olá, ${profile.user.name || ""}!</p><p>Você não tem horários livres na Insidely, então ninguém consegue agendar uma conversa com você.</p><p>Abra alguns horários — com os <strong>horários recorrentes</strong> dá para montar a semana inteira de uma vez.</p><p><a href="${getAppUrl()}/consultor/agenda">Abrir minha agenda</a></p>` }).catch(() => undefined);
    reminded++;
  }
  return reminded;
}
