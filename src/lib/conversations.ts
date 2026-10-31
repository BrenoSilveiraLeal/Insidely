import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ConversationMessage = { id: string; body: string; senderId: string; createdAt: string; readAt: string | null };
export type ConversationView = {
  bookingId: string; conversationId: string; status: string; format: "VIDEO" | "MESSAGE"; startsAt: string; durationMinutes: number; meetingUrl: string | null;
  customerId: string; consultantId: string; viewerIsConsultant: boolean; otherName: string; messages: ConversationMessage[];
};

// Conversation tables are read with the service role after checking that the viewer is one of the
// two participants. ConversationRead is added by a migration beyond the generated legacy types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

export async function getConversationForParticipant(bookingId: string, userId: string): Promise<ConversationView | null> {
  const supabase = service();
  const { data: booking } = await supabase.from("Booking").select("id, status, format, startsAt, durationMinutes, meetingUrl, customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (!booking) return null;
  const [{ data: profile }, { data: conversation }] = await Promise.all([
    supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle(),
    supabase.from("Conversation").select("id").eq("bookingId", bookingId).maybeSingle(),
  ]);
  if (!profile || !conversation || ![booking.customerId, profile.userId].includes(userId)) return null;
  // A customer self-booking their own profile counts as the consultant (it is their own profile).
  const viewerIsConsultant = profile.userId === userId;
  const [{ data: messages }, otherName] = await Promise.all([
    supabase.from("Message").select("id, body, senderId, createdAt, readAt").eq("conversationId", conversation.id).order("createdAt", { ascending: true }).limit(1000),
    viewerIsConsultant ? customerName(supabase, booking.customerId) : consultantPublicName(supabase, booking.professionalProfileId),
  ]);
  return { bookingId, conversationId: conversation.id, status: booking.status, format: (booking as { format?: string }).format === "MESSAGE" ? "MESSAGE" : "VIDEO", startsAt: booking.startsAt, durationMinutes: booking.durationMinutes, meetingUrl: booking.meetingUrl, customerId: booking.customerId, consultantId: profile.userId, viewerIsConsultant, otherName, messages: messages ?? [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function customerName(supabase: any, customerId: string) {
  const { data } = await supabase.from("User").select("name").eq("id", customerId).maybeSingle();
  return data?.name || "Cliente";
}

// The name customers already see on the profile (real name or pseudonym, per the privacy settings).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function consultantPublicName(supabase: any, profileId: string) {
  const { data } = await supabase.from("public_profile_cards").select("user").eq("id", profileId).maybeSingle();
  const user = Array.isArray(data?.user) ? data.user[0] : data?.user;
  return (user as { name?: string } | undefined)?.name || "Consultor";
}

// Opening the conversation reads everything the other side sent: the badge resets and each of those
// messages gets its own "readAt", which the sender sees as "Lida às HH:MM".
export async function markConversationRead(conversationId: string, userId: string) {
  const now = new Date().toISOString();
  const supabase = service();
  const [{ error }, { error: messageError }] = await Promise.all([
    supabase.from("ConversationRead").upsert({ conversationId, userId, lastReadAt: now }, { onConflict: "conversationId,userId" }),
    supabase.from("Message").update({ readAt: now }).eq("conversationId", conversationId).neq("senderId", userId).is("readAt", null),
  ]);
  if (error || messageError) console.error("conversation_read_failed", { conversationId, error: error ?? messageError });
}

// The conversation of a booking, only if this user takes part in it.
export async function conversationIdForParticipant(bookingId: string, userId: string) {
  const supabase = service();
  const { data: booking } = await supabase.from("Booking").select("customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (!booking) return null;
  const [{ data: profile }, { data: conversation }] = await Promise.all([
    supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle(),
    supabase.from("Conversation").select("id").eq("bookingId", bookingId).maybeSingle(),
  ]);
  return conversation && [booking.customerId, profile?.userId].includes(userId) ? conversation.id as string : null;
}

// Messages from the other side since the viewer last opened each conversation, keyed by conversation id.
export async function getUnreadCounts(userId: string, conversationIds: string[]) {
  const counts = new Map<string, number>();
  if (!conversationIds.length) return counts;
  const supabase = service();
  const [{ data: reads }, { data: messages }] = await Promise.all([
    supabase.from("ConversationRead").select("conversationId, lastReadAt").eq("userId", userId).in("conversationId", conversationIds),
    supabase.from("Message").select("conversationId, createdAt").in("conversationId", conversationIds).neq("senderId", userId).order("createdAt", { ascending: false }).limit(2000),
  ]);
  const lastRead = new Map<string, string>((reads ?? []).map((row: { conversationId: string; lastReadAt: string }) => [row.conversationId, row.lastReadAt]));
  for (const message of (messages ?? []) as { conversationId: string; createdAt: string }[]) {
    const read = lastRead.get(message.conversationId);
    if (read && message.createdAt <= read) continue;
    counts.set(message.conversationId, (counts.get(message.conversationId) ?? 0) + 1);
  }
  return counts;
}
