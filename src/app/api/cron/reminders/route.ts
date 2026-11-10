import { canReviewBooking } from "@/lib/booking-policy";
import { reactivateExpiredPauses } from "@/lib/pause";
import { emailUnreadMessages } from "@/lib/conversation-extras";
import { recordCronRun } from "@/lib/admin-log";
import { sendPendingPushes } from "@/lib/push";
import { consumeQuota } from "@/lib/auth-email-throttle";
import { parseDbDate } from "@/lib/format";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Called every 5 minutes by pg_cron (see migration 20261016000300). Closes idle chats (also scheduled
// on its own by migration 20261110100000; calling it here covers databases without that job),
// invites the customer to rate each conversation once it ends (claimed through "reviewPromptSentAt"),
// brings paused profiles back, and sends the unread-message e-mails and pending pushes.
export async function GET() {
  // The endpoint has no secret (pg_cron calls it plainly), so repeated calls from outside are cut to
  // one real run per minute; the job itself runs every 5 minutes.
  if (!await consumeQuota("cron:reminders", 1, 55)) return Response.json({ ok: true, skipped: "rate_limited" }, { status: 429 });
  // Columns and functions added by migrations beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const now = new Date();
  const { data: closedChats, error: closeError } = await supabase.rpc("close_idle_message_chats");
  if (closeError) console.error("close_idle_chats_failed", { error: closeError });
  const reviewPrompts = await sendReviewPrompts(supabase, now);
  const resumedPauses = await reactivateExpiredPauses(supabase, now).catch(() => 0);
  const unreadEmails = await emailUnreadMessages(supabase, now).catch((error) => { console.error("unread_scan_failed", { error }); return 0; });
  const pushes = await sendPendingPushes(supabase, now).catch((error) => { console.error("push_scan_failed", { error }); return 0; });
  const result = { ok: true, closedChats: closedChats ?? 0, reviewPrompts, resumedPauses, unreadEmails, pushes };
  await recordCronRun(supabase, "reminders", true, result);
  return Response.json(result);
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
    const { error: notificationError } = await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: booking.customerId, title: "Avalie sua conversa", body: "Sua conversa terminou. Dê uma nota de 0 a 5 e deixe um comentário, se quiser.", href: "/dashboard/avaliacoes", createdAt: now.toISOString() });
    if (notificationError) console.error("review_prompt_notification_failed", { bookingId: booking.id, error: notificationError });
    else prompted++;
  }
  return prompted;
}
