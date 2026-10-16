import { NextRequest, NextResponse } from "next/server";
import { isMeetingRoomOpen } from "@/lib/booking-policy";
import { parseDbDate } from "@/lib/format";
import { ensureGoogleMeetForBooking } from "@/lib/google-meet";
import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Gatekeeper for the video room. Google Meet links never expire, so the raw link is not shared:
// only participants are sent to it, and only from 10 minutes before the start until the end.
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
  return NextResponse.redirect(meetingUrl ?? new URL(`/consulta/${id}`, request.url));
}
