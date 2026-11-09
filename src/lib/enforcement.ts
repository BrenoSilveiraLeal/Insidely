import "server-only";
import { sendBookingCancellationEmail, sendSecurityEmail } from "@/lib/email";
import { cancelBookingAndRefund } from "@/lib/stripe-payments";

// Graduated enforcement (Terms, "Advertências, suspensões e banimento"; rules in enforcement-policy.ts):
// every 3 warnings suspend the account for 7, then 30, then 60 days, and 3 more warnings ban it. Used
// by the admin account page and by the decision on a contested conversation.
import { WARNINGS_PER_SUSPENSION, enforcementSummary, nextSuspensionDays } from "@/lib/enforcement-policy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = any;

// Suspends (days) or bans (null) an account: out of search and booking, upcoming conversations with
// it as consultant cancelled with a full refund, an e-mail, and a row in AccountSuspension.
export async function suspendAccount(supabase: Service, { userId, days, reason, adminUserId, automatic = false }: { userId: string; days: number | null; reason: string; adminUserId: string | null; automatic?: boolean }) {
  const now = new Date();
  const until = days ? new Date(now.getTime() + days * 86_400_000) : null;
  const { error } = await supabase.from("User").update({ suspendedAt: now.toISOString(), suspendedUntil: until?.toISOString() ?? null, suspensionReason: reason, updatedAt: now.toISOString() }).eq("id", userId).neq("role", "ADMIN");
  if (error) throw new Error(error.message);
  await supabase.from("AccountSuspension").insert({ userId, adminUserId, reason, endsAt: until?.toISOString() ?? null, automatic }).then(() => undefined, (insertError: unknown) => console.error("suspension_history_failed", { userId, error: insertError }));
  const { data: person } = await supabase.from("User").select("email, name").eq("id", userId).maybeSingle();
  if (person?.email) await sendSecurityEmail(person.email, person.name, "suspended", { reason, until: until ? until.toLocaleString("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }) : null }).catch((emailError) => console.error("suspension_email_failed", { error: emailError }));
  // Out of search and booking while suspended; free slots are kept for when it is lifted.
  const { data: profile } = await supabase.from("ProfessionalProfile").update({ isActive: false, updatedAt: now.toISOString() }).eq("userId", userId).select("id").maybeSingle();
  // Conversations already booked with a suspended consultant will not happen: cancel them with a full
  // refund (the customer did nothing wrong; the platform absorbs the card processing fee).
  let cancelled = 0, failed = 0;
  if (profile) {
    const { data: upcoming } = await supabase.from("Booking").select("id").eq("professionalProfileId", profile.id).in("status", ["PENDING_PAYMENT", "CONFIRMED"]).gt("startsAt", now.toISOString()).neq("customerId", userId);
    const notice = "O consultor não está mais disponível na plataforma, por isso a Insidely cancelou a conversa.";
    for (const booking of upcoming ?? []) {
      try {
        const result = await cancelBookingAndRefund({ bookingId: booking.id, consultantId: userId, reason: "Consultor suspenso pela equipe da Insidely.", customerNotice: notice });
        try { await sendBookingCancellationEmail(supabase, booking.id, notice, result.refunded); } catch (emailError) { console.error("suspension_cancellation_email_failed", { bookingId: booking.id, error: emailError }); }
        cancelled++;
      } catch (cancelError) { failed++; console.error("suspension_cancellation_failed", { bookingId: booking.id, error: cancelError }); }
    }
  }
  return { cancelled, failed };
}

// Records a warning (notification and e-mail) and applies the graduated enforcement.
export async function warnAccount(supabase: Service, { userId, adminUserId, reason }: { userId: string; adminUserId: string; reason: string }) {
  await supabase.from("AccountWarning").insert({ userId, adminUserId, reason });
  const now = new Date().toISOString();
  await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId, title: "Advertência na sua conta", body: `${reason} ${enforcementSummary()}`, href: "/termos", createdAt: now });
  const { data: warned } = await supabase.from("User").select("email, name").eq("id", userId).maybeSingle();
  if (warned?.email) await sendSecurityEmail(warned.email, warned.name, "warning", { reason }).catch((error) => console.error("warning_email_failed", { error }));
  const { count: warnings } = await supabase.from("AccountWarning").select("id", { count: "exact", head: true }).eq("userId", userId);
  if (!warnings || warnings % WARNINGS_PER_SUSPENSION !== 0) return { suspended: false, banned: false };
  const { count: suspensions } = await supabase.from("AccountSuspension").select("id", { count: "exact", head: true }).eq("userId", userId);
  const days = nextSuspensionDays(suspensions ?? 0);
  const banned = days === null;
  await suspendAccount(supabase, {
    userId, adminUserId, automatic: true, days,
    reason: banned ? `Conta banida: advertências acumuladas após ${suspensions} suspensões.` : `Suspensão automática de ${days} dias: ${warnings} advertências.`,
  });
  return { suspended: true, banned };
}

// A suspension ends on its own when its date passes: access already returns then (session.ts reads the
// date), and this clears the record, puts a consultant's profile back in search (unless the consultant
// paused it) and tells the person. Runs from the daily job and when the person next signs in.
// Bans (no end date) are never lifted here.
export async function liftExpiredSuspensions(supabase: Service, userId?: string) {
  const now = new Date().toISOString();
  let query = supabase.from("User").update({ suspendedAt: null, suspendedUntil: null, suspensionReason: null, updatedAt: now })
    .not("suspendedAt", "is", null).not("suspendedUntil", "is", null).lte("suspendedUntil", now);
  if (userId) query = query.eq("id", userId);
  const { data: lifted, error } = await query.select("id, auth_user_id");
  if (error) throw new Error(error.message);
  for (const user of (lifted ?? []) as { id: string; auth_user_id: string | null }[]) {
    // A deleted account keeps its profile off; it comes back only if the person reactivates the account.
    if (user.auth_user_id) await supabase.from("ProfessionalProfile").update({ isActive: true, updatedAt: now }).eq("userId", user.id).is("pausedAt", null);
    await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: user.id, title: "Suspensão encerrada", body: "O prazo da suspensão terminou e sua conta voltou a funcionar normalmente.", href: "/continuar", createdAt: now });
  }
  return (lifted ?? []).length;
}
