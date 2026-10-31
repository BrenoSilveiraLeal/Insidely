import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// For a list of conversations, which ones are with someone this user has blocked (so the safety
// row offers "Desbloquear" instead of "Bloquear").
export async function getBlockedBookingIds(userId: string, bookingIds: string[]) {
  const blocked = new Set<string>();
  if (!bookingIds.length) return blocked;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const [{ data: blocks }, { data: bookings }] = await Promise.all([
    supabase.from("UserBlock").select("blockedId").eq("blockerId", userId),
    supabase.from("Booking").select("id, customerId, professionalProfile:ProfessionalProfile(userId)").in("id", bookingIds),
  ]);
  const ids = new Set(((blocks ?? []) as { blockedId: string }[]).map((row) => row.blockedId));
  if (!ids.size) return blocked;
  for (const booking of (bookings ?? []) as { id: string; customerId: string; professionalProfile: { userId: string } | { userId: string }[] | null }[]) {
    const consultantId = (Array.isArray(booking.professionalProfile) ? booking.professionalProfile[0] : booking.professionalProfile)?.userId;
    const other = booking.customerId === userId ? consultantId : booking.customerId;
    if (other && ids.has(other)) blocked.add(booking.id);
  }
  return blocked;
}
