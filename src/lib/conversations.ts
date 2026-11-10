import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ConversationMessage = { id: string; body: string; senderId: string; createdAt: string; readAt: string | null; automatic?: boolean };
export type ConversationView = {
  bookingId: string; conversationId: string; status: string; format: "VIDEO" | "MESSAGE"; startsAt: string; durationMinutes: number; meetingUrl: string | null;
  customerId: string; consultantId: string; viewerIsConsultant: boolean; otherName: string; messages: ConversationMessage[];
  // Photo of the other person as the viewer may see it (null: anonymous, hidden or none).
  otherImage: string | null;
  // Whether the consultant hides their identity (anonymous mode): the chat reminds them not to reveal it.
  consultantAnonymous: boolean;
  // "Perguntas por mensagem": questions in the request and how many were sent so far (one at a time).
  questionsTotal: number; questionsSent: number;
  // When the held amount is released if nobody contests (set when the consultant finishes).
  autoReleaseAt: string | null;
  // What the customer wrote they want to talk about (video bookings), shown at the top of the chat.
  goals: string;
};

// Conversation tables are read with the service role after checking that the viewer is one of the
// two participants. ConversationRead is added by a migration beyond the generated legacy types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

export async function getConversationForParticipant(bookingId: string, userId: string): Promise<ConversationView | null> {
  const supabase = service();
  const { data: booking } = await supabase.from("Booking").select("id, status, format, startsAt, durationMinutes, meetingUrl, customerId, professionalProfileId, questions, questionsSent, autoReleaseAt, goals").eq("id", bookingId).maybeSingle();
  if (!booking) return null;
  const [{ data: profile }, { data: conversation }] = await Promise.all([
    supabase.from("ProfessionalProfile").select("userId").eq("id", booking.professionalProfileId).maybeSingle(),
    supabase.from("Conversation").select("id").eq("bookingId", bookingId).maybeSingle(),
  ]);
  if (!profile || !conversation || ![booking.customerId, profile.userId].includes(userId)) return null;
  // A customer self-booking their own profile counts as the consultant (it is their own profile).
  const viewerIsConsultant = profile.userId === userId;
  const [{ data: messages }, other, consultantCard] = await Promise.all([
    supabase.from("Message").select("id, body, senderId, createdAt, readAt, automatic").eq("conversationId", conversation.id).order("createdAt", { ascending: true }).limit(1000),
    viewerIsConsultant ? customerName(supabase, booking.customerId) : Promise.resolve(null),
    consultantPublicCard(supabase, booking.professionalProfileId),
  ]);
  const otherName = other?.name ?? consultantCard.name;
  const otherImage = other ? other.image : consultantCard.image;
  return { autoReleaseAt: booking.autoReleaseAt ?? null, goals: String(booking.goals ?? "").trim(), questionsTotal: Array.isArray(booking.questions) ? booking.questions.length : 0, questionsSent: Number(booking.questionsSent ?? 0), bookingId, conversationId: conversation.id, status: booking.status, format: (booking as { format?: string }).format === "MESSAGE" ? "MESSAGE" : "VIDEO", startsAt: booking.startsAt, durationMinutes: booking.durationMinutes, meetingUrl: booking.meetingUrl, customerId: booking.customerId, consultantId: profile.userId, viewerIsConsultant, otherName, otherImage, consultantAnonymous: consultantCard.anonymous, messages: messages ?? [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function customerName(supabase: any, customerId: string) {
  const { data } = await supabase.from("User").select("name, image").eq("id", customerId).maybeSingle();
  return { name: data?.name || "Cliente", image: (data?.image as string | null) ?? null };
}

// The name and photo customers already see on the profile (real name or pseudonym, photo only when
// shown, per the privacy settings), and whether the consultant is in anonymous mode.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function consultantPublicCard(supabase: any, profileId: string) {
  const [{ data }, { data: own }] = await Promise.all([
    supabase.from("public_profile_cards").select("user").eq("id", profileId).maybeSingle(),
    supabase.from("ProfessionalProfile").select("privacyMode").eq("id", profileId).maybeSingle(),
  ]);
  const user = (Array.isArray(data?.user) ? data.user[0] : data?.user) as { name?: string; image?: string | null } | undefined;
  return { name: user?.name || "Consultor", image: user?.image ?? null, anonymous: own?.privacyMode === "PSEUDONYM" };
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
  const { data: messages } = await supabase.from("Message").select("conversationId").in("conversationId", conversationIds).neq("senderId", userId).is("readAt", null).limit(2000);
  for (const message of (messages ?? []) as { conversationId: string }[]) {
    counts.set(message.conversationId, (counts.get(message.conversationId) ?? 0) + 1);
  }
  return counts;
}
