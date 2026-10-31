import "server-only";
import { sendTransactionalEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";

// The consultant's welcome message, posted in the chat on their behalf as soon as a payment is
// confirmed. Written once in "Editar perfil" and checked by the chat filter when saved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function postWelcomeMessage(supabase: any, bookingId: string) {
  const { data: booking } = await supabase.from("Booking").select("customerId, professionalProfileId").eq("id", bookingId).maybeSingle();
  if (!booking) return;
  const [{ data: profile }, { data: conversation }] = await Promise.all([
    supabase.from("ProfessionalProfile").select("userId, welcomeMessage").eq("id", booking.professionalProfileId).maybeSingle(),
    supabase.from("Conversation").select("id").eq("bookingId", bookingId).maybeSingle(),
  ]);
  if (!profile?.welcomeMessage || !conversation || profile.userId === booking.customerId) return;
  const { count } = await supabase.from("Message").select("id", { count: "exact", head: true }).eq("conversationId", conversation.id);
  if (count) return;
  await supabase.from("Message").insert({ id: crypto.randomUUID(), conversationId: conversation.id, senderId: profile.userId, body: profile.welcomeMessage, createdAt: new Date().toISOString() });
}

// Messages nobody read for 3 hours (sent in the last 2 days) trigger one e-mail per conversation to
// the recipient. Each message is claimed through "emailedAt", so nothing is e-mailed twice.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function emailUnreadMessages(supabase: any, now = new Date()) {
  const { data: messages } = await supabase.from("Message").select("id, conversationId, senderId")
    .is("readAt", null).is("emailedAt", null)
    .lte("createdAt", new Date(now.getTime() - 3 * 3_600_000).toISOString())
    .gte("createdAt", new Date(now.getTime() - 48 * 3_600_000).toISOString()).limit(200);
  if (!messages?.length) return 0;
  const byConversation = new Map<string, { ids: string[]; senderId: string }>();
  for (const message of messages as { id: string; conversationId: string; senderId: string }[]) {
    const entry = byConversation.get(message.conversationId) ?? { ids: [], senderId: message.senderId };
    entry.ids.push(message.id);
    byConversation.set(message.conversationId, entry);
  }
  let sent = 0;
  for (const [conversationId, entry] of byConversation) {
    const { data: claimed } = await supabase.from("Message").update({ emailedAt: now.toISOString() }).in("id", entry.ids).is("emailedAt", null).select("id");
    if (!claimed?.length) continue;
    const { data: conversation } = await supabase.from("Conversation").select("bookingId, booking:Booking(customerId, professionalProfile:ProfessionalProfile(userId))").eq("id", conversationId).maybeSingle();
    const booking = Array.isArray(conversation?.booking) ? conversation.booking[0] : conversation?.booking;
    const consultant = Array.isArray(booking?.professionalProfile) ? booking.professionalProfile[0] : booking?.professionalProfile;
    if (!booking || !consultant) continue;
    const recipientId = entry.senderId === booking.customerId ? consultant.userId : booking.customerId;
    const [{ data: recipient }, { data: sender }] = await Promise.all([
      supabase.from("User").select("email, name").eq("id", recipientId).maybeSingle(),
      supabase.from("User").select("name").eq("id", entry.senderId).maybeSingle(),
    ]);
    if (!recipient?.email) continue;
    const total = claimed.length;
    await sendTransactionalEmail({ to: recipient.email, subject: `Você tem ${total === 1 ? "uma mensagem nova" : `${total} mensagens novas`} na Insidely`, html: `<p>Olá, ${recipient.name || ""}!</p><p>${sender?.name || "A outra pessoa"} enviou ${total === 1 ? "uma mensagem" : `${total} mensagens`} na conversa de vocês e ainda não foi lida.</p><p><a href="${getAppUrl()}/conversa/${conversation.bookingId}">Abrir a conversa</a></p>` }).catch((error) => console.error("unread_email_failed", { conversationId, error }));
    sent++;
  }
  return sent;
}
