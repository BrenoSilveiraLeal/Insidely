import { NextRequest, NextResponse } from "next/server";
import { isMeetingRoomOpen } from "@/lib/booking-policy";
import { parseDbDate } from "@/lib/format";
import { ensureGoogleMeetForBooking } from "@/lib/google-meet";
import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Gatekeeper for the video room. The raw Meet link is never shared: only participants are sent to
// it, and only between the scheduled start and end. The Google space itself is created on the first
// visit after the start and locked after the end (see google-meet.ts).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.redirect(new URL(`/entrar?next=${encodeURIComponent(`/sala/${id}`)}`, request.url));
  // meetingUrl is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: booking } = await supabase.from("Booking").select("id, status, startsAt, durationMinutes, meetingUrl, customerId, professionalProfileId").eq("id", id).maybeSingle();
  const { data: profile } = booking ? await supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle() : { data: null };
  const participant = booking && (booking.customerId === user.id || profile?.userId === user.id);
  if (!participant || !["CONFIRMED", "AWAITING_CONFIRMATION"].includes(booking.status)) return NextResponse.redirect(new URL("/dashboard/agendamentos", request.url));
  if (!isMeetingRoomOpen(parseDbDate(booking.startsAt), booking.durationMinutes)) return NextResponse.redirect(new URL(`/consulta/${id}`, request.url));
  const meetingUrl = booking.meetingUrl ?? await ensureGoogleMeetForBooking(supabase, id).catch(() => null);
  if (meetingUrl) await recordRoomEntry(supabase, id, user.id).catch((error) => console.error("room_attendance_failed", { bookingId: id, error }));
  return NextResponse.redirect(meetingUrl ?? new URL(`/consulta/${id}`, request.url));
}

// Attendance evidence for disputes ("the consultant never showed up"): the raw Meet link is only
// handed out here, so every entry to the room passes through this route.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recordRoomEntry(supabase: any, bookingId: string, userId: string) {
  const now = new Date().toISOString();
  const { data: existing } = await supabase.from("RoomAttendance").select("entries").eq("bookingId", bookingId).eq("userId", userId).maybeSingle();
  if (existing) await supabase.from("RoomAttendance").update({ lastEnteredAt: now, entries: existing.entries + 1 }).eq("bookingId", bookingId).eq("userId", userId);
  else await supabase.from("RoomAttendance").insert({ bookingId, userId, firstEnteredAt: now, lastEnteredAt: now });
}
