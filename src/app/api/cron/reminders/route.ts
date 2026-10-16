import { sendBookingReminderEmails } from "@/lib/email";
import { parseDbDate, shortDate } from "@/lib/format";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const WINDOW_MS = 65 * 60_000;

// Called every 5 minutes by pg_cron (see migration 20261016000300). Sends one reminder per confirmed
// conversation about an hour before it starts. Safe to call by anyone: each booking is claimed
// atomically through "reminderSentAt", so repeated calls never send duplicates.
export async function GET() {
  // reminderSentAt is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const now = new Date();
  const { data: bookings, error } = await supabase.from("Booking")
    .select("id, startsAt, paymentConfirmedAt, customerId, professionalProfileId")
    .eq("status", "CONFIRMED").is("reminderSentAt", null)
    .gt("startsAt", now.toISOString()).lte("startsAt", new Date(now.getTime() + WINDOW_MS).toISOString())
    .limit(50);
  if (error) return Response.json({ error: "reminder_lookup_failed" }, { status: 500 });

  let reminded = 0, skipped = 0;
  for (const booking of bookings ?? []) {
    const { data: claimed } = await supabase.from("Booking").update({ reminderSentAt: now.toISOString() }).eq("id", booking.id).is("reminderSentAt", null).select("id").maybeSingle();
    if (!claimed) continue;
    const startsAt = parseDbDate(booking.startsAt);
    // Paid within the reminder window: the confirmation (with link and time) was just delivered.
    if (booking.paymentConfirmedAt && startsAt.getTime() - parseDbDate(booking.paymentConfirmedAt).getTime() < WINDOW_MS) { skipped++; continue; }
    const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
    const when = shortDate(startsAt);
    const rows = [
      { id: crypto.randomUUID(), userId: booking.customerId, title: "Sua conversa começa em breve", body: `Começa em ${when}. O link da sala está no chat da conversa.`, href: "/dashboard/mensagens", createdAt: now.toISOString() },
      ...(profile?.userId && profile.userId !== booking.customerId ? [{ id: crypto.randomUUID(), userId: profile.userId, title: "Sua conversa começa em breve", body: `Começa em ${when}. O link da sala está no chat da consulta.`, href: "/consultor/consultas", createdAt: now.toISOString() }] : []),
    ];
    const { error: notificationError } = await supabase.from("Notification").insert(rows);
    if (notificationError) console.error("reminder_notification_failed", { bookingId: booking.id, error: notificationError });
    try { await sendBookingReminderEmails(supabase, booking.id); }
    catch (mailError) { console.error("reminder_email_failed", { bookingId: booking.id, error: mailError }); }
    reminded++;
  }
  return Response.json({ ok: true, reminded, skipped });
}
