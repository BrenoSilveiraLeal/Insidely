import { ensureGoogleMeetForBooking } from "@/lib/google-meet";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (process.env.GOOGLE_MEET_ENABLED !== "true") return Response.json({ ok: true, created: 0, disabled: true });

  // The service role is required because this is a protected scheduled job.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: bookings, error } = await supabase.from("Booking").select("id").eq("status", "CONFIRMED").is("meetingUrl", null).gt("startsAt", new Date().toISOString()).limit(25);
  if (error) return Response.json({ error: "meeting_lookup_failed", detail: error.message }, { status: 500 });
  let created = 0;
  for (const booking of bookings ?? []) {
    try {
      if (await ensureGoogleMeetForBooking(supabase, booking.id)) created++;
    } catch (meetingError) {
      console.error("google_meet_creation_failed", booking.id, meetingError);
    }
  }
  return Response.json({ ok: true, created });
}
