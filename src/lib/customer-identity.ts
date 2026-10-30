import "server-only";
import { ageOn, maskCpf } from "@/lib/identity";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type CustomerIdentitySummary = { maskedCpf: string; age: number; registeredAt: string };
export type CustomerReputation = { average: number; count: number; label: "Bom cliente" | "Cliente regular" | "Atenção"; recent: { rating: number; comment: string | null; createdAt: string }[] };
export type ConsultantCustomerInfo = CustomerIdentitySummary & { memberSince: string; pastConversations: number; reputation: CustomerReputation | null };

// Average of the stars consultants gave after past conversations, like guest reviews on Airbnb.
export function reputationLabel(average: number): CustomerReputation["label"] {
  return average >= 4 ? "Bom cliente" : average >= 2.5 ? "Cliente regular" : "Atenção";
}

export async function getCustomerReputations(customerIds: string[]) {
  const result = new Map<string, CustomerReputation>();
  if (!customerIds.length) return result;
  const { data, error } = await service().from("CustomerFeedback").select("customerId, rating, comment, createdAt").in("customerId", customerIds).order("createdAt", { ascending: false });
  if (error) { console.error("customer_reputation_lookup_failed", { error }); return result; }
  for (const customerId of customerIds) {
    const rows = (data ?? []).filter((row: { customerId: string }) => row.customerId === customerId) as { rating: number; comment: string | null; createdAt: string }[];
    if (!rows.length) continue;
    const average = rows.reduce((sum, row) => sum + row.rating, 0) / rows.length;
    result.set(customerId, { average, count: rows.length, label: reputationLabel(average), recent: rows.filter((row) => row.comment).slice(0, 3) });
  }
  return result;
}

// CustomerIdentity is not exposed to the Data API at all (migration 20261029130000); the server
// reads it with the service role and only ever hands out the masked CPF and the age.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

export async function getCustomerIdentity(userId: string): Promise<CustomerIdentitySummary | null> {
  const { data, error } = await service().from("CustomerIdentity").select("cpf, birthDate, createdAt").eq("userId", userId).maybeSingle();
  if (error) throw new Error(`customer_identity_lookup: ${error.message}`);
  return data ? { maskedCpf: maskCpf(data.cpf), age: ageOn(data.birthDate), registeredAt: data.createdAt } : null;
}

// Basic data about the people who booked a consultant, keyed by booking id. The booking ids must
// come from the consultant's own bookings (getConsultantBookings), which is checked again here.
export async function getCustomersForConsultant(consultantUserId: string, bookingIds: string[]) {
  const result = new Map<string, ConsultantCustomerInfo | null>();
  if (!bookingIds.length) return result;
  const supabase = service();
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", consultantUserId).maybeSingle();
  if (!profile) return result;
  const { data: bookings } = await supabase.from("Booking").select("id, customerId").in("id", bookingIds).eq("professionalProfileId", profile.id);
  const customerIds = [...new Set((bookings ?? []).map((booking: { customerId: string }) => booking.customerId))];
  if (!customerIds.length) return result;
  const [{ data: identities }, { data: users }, { data: history }, reputations] = await Promise.all([
    supabase.from("CustomerIdentity").select("userId, cpf, birthDate, createdAt").in("userId", customerIds),
    supabase.from("User").select("id, createdAt").in("id", customerIds),
    supabase.from("Booking").select("customerId").in("customerId", customerIds).in("status", ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"]),
    getCustomerReputations(customerIds as string[]),
  ]);
  for (const booking of bookings ?? []) {
    const identity = (identities ?? []).find((item: { userId: string }) => item.userId === booking.customerId);
    const user = (users ?? []).find((item: { id: string }) => item.id === booking.customerId);
    result.set(booking.id, identity ? {
      maskedCpf: maskCpf(identity.cpf), age: ageOn(identity.birthDate), registeredAt: identity.createdAt,
      memberSince: user?.createdAt ?? identity.createdAt,
      pastConversations: (history ?? []).filter((item: { customerId: string }) => item.customerId === booking.customerId).length,
      reputation: reputations.get(booking.customerId) ?? null,
    } : null);
  }
  return result;
}
