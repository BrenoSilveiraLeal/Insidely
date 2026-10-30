import { closeEndedMeetings, ensureGoogleMeetForBooking } from "@/lib/google-meet";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

import { isCronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (process.env.GOOGLE_MEET_ENABLED !== "true") return Response.json({ ok: true, created: 0, disabled: true });

  // The service role is required because this is a protected scheduled job.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  // Rooms are created when a conversation starts; this only prepares rooms for conversations already
  // under way that nobody has opened yet, and locks the rooms of conversations that ended.
  const { data: bookings, error } = await supabase.from("Booking").select("id").eq("status", "CONFIRMED").is("meetingUrl", null).lte("startsAt", new Date().toISOString()).gt("startsAt", new Date(Date.now() - 2 * 60 * 60_000).toISOString()).limit(25);
  if (error) return Response.json({ error: "meeting_lookup_failed", detail: error.message }, { status: 500 });
  let created = 0;
  for (const booking of bookings ?? []) {
    try {
      if (await ensureGoogleMeetForBooking(supabase, booking.id)) created++;
    } catch (meetingError) {
      console.error("google_meet_creation_failed", booking.id, meetingError);
    }
  }
  const closed = await closeEndedMeetings(supabase);
  return Response.json({ ok: true, created, closed });
}
