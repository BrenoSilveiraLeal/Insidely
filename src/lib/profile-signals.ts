import "server-only";
import { cache } from "react";
import { parseDbDate } from "@/lib/format";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Trust signals shown on public profiles, computed from data the platform already keeps.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

// Consultant profiles whose owner registered a CPF ("Identidade verificada"). One query per request.
export const getIdentityVerifiedProfileIds = cache(async () => {
  const { data, error } = await service().from("ProfessionalProfile").select("id, user:User!inner(identity:CustomerIdentity!inner(userId))").eq("isActive", true);
  if (error) { console.error("identity_signal_failed", { error }); return new Set<string>(); }
  return new Set<string>((data ?? []).map((row: { id: string }) => row.id));
});

const PAID = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"];

// "Responde rápido": median time between the customer's first message and the consultant's first
// answer, over the last 90 days, with at least 3 conversations. Attendance: share of finished
// conversations (since attendance tracking started) where the consultant entered the room.
export async function getProfileSignals(profileId: string) {
  const supabase = service();
  const { data: profile } = await supabase.from("ProfessionalProfile").select("userId").eq("id", profileId).maybeSingle();
  if (!profile) return { fastResponder: false, medianResponseHours: null as number | null, attendanceRate: null as number | null };
  const since = new Date(Date.now() - 90 * 24 * 60 * 60_000).toISOString();
  const { data: bookings } = await supabase.from("Booking").select("id, status, startsAt, durationMinutes, noShowCheckedAt, conversation:Conversation(id)").eq("professionalProfileId", profileId).in("status", PAID).gte("createdAt", since);
  const rows = (bookings ?? []) as { id: string; status: string; startsAt: string; durationMinutes: number; noShowCheckedAt: string | null; conversation: { id: string } | { id: string }[] | null }[];
  const conversationIds = rows.flatMap((row) => { const c = Array.isArray(row.conversation) ? row.conversation[0] : row.conversation; return c ? [c.id] : []; });
  const { data: messages } = conversationIds.length ? await supabase.from("Message").select("conversationId, senderId, createdAt").in("conversationId", conversationIds).order("createdAt", { ascending: true }) : { data: [] };
  const delays: number[] = [];
  for (const conversationId of conversationIds) {
    const thread = (messages ?? []).filter((m: { conversationId: string }) => m.conversationId === conversationId) as { senderId: string; createdAt: string }[];
    const firstCustomer = thread.find((m) => m.senderId !== profile.userId);
    const answer = firstCustomer && thread.find((m) => m.senderId === profile.userId && m.createdAt > firstCustomer.createdAt);
    if (firstCustomer && answer) delays.push((parseDbDate(answer.createdAt).getTime() - parseDbDate(firstCustomer.createdAt).getTime()) / 3_600_000);
  }
  delays.sort((a, b) => a - b);
  const median = delays.length >= 3 ? delays[Math.floor(delays.length / 2)] : null;
  const tracked = rows.filter((row) => row.noShowCheckedAt);
  let attendanceRate: number | null = null;
  if (tracked.length >= 3) {
    const { data: entries } = await supabase.from("RoomAttendance").select("bookingId").eq("userId", profile.userId).in("bookingId", tracked.map((row) => row.id));
    attendanceRate = Math.round(((entries ?? []).length / tracked.length) * 100);
  }
  return { fastResponder: median !== null && median <= 3, medianResponseHours: median, attendanceRate };
}

export async function isWatchingAvailability(userId: string, profileId: string) {
  const { data } = await service().from("AvailabilityWatch").select("userId").eq("userId", userId).eq("professionalProfileId", profileId).maybeSingle();
  return Boolean(data);
}
