import { canReviewBooking } from "@/lib/booking-policy";
import { sendBookingReminderEmails } from "@/lib/email";
import { closeEndedMeetings } from "@/lib/google-meet";
import { parseDbDate, shortDate } from "@/lib/format";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const WINDOW_MS = 65 * 60_000;

// Called every 5 minutes by pg_cron (see migration 20261016000300). Sends one reminder per confirmed
// conversation about an hour before it starts. Safe to call by anyone: each booking is claimed
// atomically through "reminderSentAt", so repeated calls never send duplicates. Also invites the
// customer to rate each conversation once it ends (claimed through "reviewPromptSentAt") and locks
// the Google Meet room of every conversation whose time is over.
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
      { id: crypto.randomUUID(), userId: booking.customerId, title: "Sua conversa começa em breve", body: `Começa em ${when}. O link da sala está no chat da conversa e abre no horário marcado.`, href: "/dashboard/mensagens", createdAt: now.toISOString() },
      ...(profile?.userId && profile.userId !== booking.customerId ? [{ id: crypto.randomUUID(), userId: profile.userId, title: "Sua conversa começa em breve", body: `Começa em ${when}. O link da sala está no chat da consulta.`, href: "/consultor/consultas", createdAt: now.toISOString() }] : []),
    ];
    const { error: notificationError } = await supabase.from("Notification").insert(rows);
    if (notificationError) console.error("reminder_notification_failed", { bookingId: booking.id, error: notificationError });
    try { await sendBookingReminderEmails(supabase, booking.id); }
    catch (mailError) { console.error("reminder_email_failed", { bookingId: booking.id, error: mailError }); }
    reminded++;
  }
  const reviewPrompts = await sendReviewPrompts(supabase, now);
  const closedRooms = await closeEndedMeetings(supabase, now);
  return Response.json({ ok: true, reminded, skipped, reviewPrompts, closedRooms });
}

// Once a paid conversation's scheduled end passes, invite the customer to rate it. Only bookings
// that ended in the last 3 days are considered, so older history is never notified retroactively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendReviewPrompts(supabase: any, now: Date) {
  const { data: bookings, error } = await supabase.from("Booking")
    .select("id, startsAt, durationMinutes, customerId, professionalProfileId")
    .in("status", ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"]).is("reviewPromptSentAt", null).is("disputedAt", null)
    .gt("startsAt", new Date(now.getTime() - 3 * 24 * 60 * 60_000).toISOString()).lte("startsAt", now.toISOString())
    .limit(50);
  if (error) { console.error("review_prompt_lookup_failed", { error }); return 0; }
  let prompted = 0;
  for (const booking of bookings ?? []) {
    if (!canReviewBooking("CONFIRMED", parseDbDate(booking.startsAt), booking.durationMinutes, now)) continue;
    const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle();
    if (!profile || profile.userId === booking.customerId) continue;
    const { data: claimed } = await supabase.from("Booking").update({ reviewPromptSentAt: now.toISOString() }).eq("id", booking.id).is("reviewPromptSentAt", null).select("id").maybeSingle();
    if (!claimed) continue;
    const { error: notificationError } = await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: booking.customerId, title: "Avalie sua conversa", body: "O horário da conversa terminou. Dê uma nota de 0 a 5 e deixe um comentário, se quiser.", href: "/dashboard/avaliacoes", createdAt: now.toISOString() });
    if (notificationError) console.error("review_prompt_notification_failed", { bookingId: booking.id, error: notificationError });
    else prompted++;
  }
  return prompted;
}
