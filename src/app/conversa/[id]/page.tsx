import Link from "next/link";
import { notFound } from "next/navigation";
import { sendMessageAction } from "@/app/actions";
import { BlockUserForm, ConversationReportForm, reportFeedbackText } from "@/components/conversation-safety";
import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingRoomMessage } from "@/components/meeting-room-message";
import { RealtimeMessageThread } from "@/components/realtime-message-thread";
import { StartsIn } from "@/components/starts-in";
import { PrepChecklist } from "@/components/prep-checklist";
import { canSendBookingMessage, chatClosedReason, chatOpensAt } from "@/lib/booking-policy";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { chatFeedbackText } from "@/lib/chat-moderation";
import { getConversationForParticipant, markConversationRead } from "@/lib/conversations";
import { Role } from "@/lib/domain";
import { bookingStatusLabel, parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Conversa" };
export const dynamic = "force-dynamic";

// The preparation checklist appears in the 24 hours before the conversation and while it happens.
function showChecklist(startsAt: Date, durationMinutes: number) {
  const now = Date.now();
  return startsAt.getTime() - now < 24 * 60 * 60_000 && startsAt.getTime() + durationMinutes * 60_000 > now;
}

function chatNotOpenYet(startsAt: Date) {
  return Date.now() < chatOpensAt(startsAt).getTime();
}

const REPORTABLE = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"];

// One conversation on its own page, so a long history never stretches the booking cards.
export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mensagem?: string; denuncia?: string; bloqueio?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser([Role.USER, Role.CONSULTANT], { nextPath: `/conversa/${id}` });
  const conversation = await getConversationForParticipant(id, user.id);
  if (!conversation) notFound();
  await markConversationRead(conversation.conversationId, user.id);
  const consultantMode = conversation.viewerIsConsultant && user.role === Role.CONSULTANT;
  const backHref = consultantMode ? "/consultor/consultas" : "/dashboard/mensagens";
  const here = `/conversa/${id}`;
  const startsAt = parseDbDate(conversation.startsAt);
  // Messages this person tried to send and the moderation refused (only they see these notices).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: blockedRows } = await (createSupabaseServiceClient() as any).from("ChatModerationEvent").select("id, reason, createdAt").eq("conversationId", conversation.conversationId).eq("userId", user.id).order("createdAt").limit(50);
  const canSend = canSendBookingMessage(conversation.status, startsAt, conversation.durationMinutes);
  const notOpenYet = conversation.status === "CONFIRMED" && chatNotOpenYet(startsAt);
  return <DashboardShell mode={consultantMode ? "consultant" : "user"} title={`Conversa com ${conversation.otherName}`} canConsultant={user.role === Role.CONSULTANT}>
    <div className="conversation-page">
      <div className="conversation-header"><Link className="text-link" href={backHref}>← Voltar</Link><span className="eyebrow">{bookingStatusLabel(conversation.status)} · {shortDate(startsAt)} · {conversation.durationMinutes} min</span>{conversation.status === "CONFIRMED" && <StartsIn startsAt={startsAt.toISOString()} durationMinutes={conversation.durationMinutes}/>}</div>
      {query.bloqueio === "ok" && <p className="form-feedback" role="status">Pessoa bloqueada. Vocês não conseguem mais agendar novas conversas um com o outro.</p>}
      {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
      {conversation.status === "CONFIRMED" && showChecklist(startsAt, conversation.durationMinutes) && <PrepChecklist/>}
      <MeetingRoomMessage booking={{ id, status: conversation.status, startsAt, durationMinutes: conversation.durationMinutes, meetingUrl: conversation.meetingUrl }} calendarSide={consultantMode ? "consultant" : "customer"}/>
      <section className="panel conversation-panel">
        <RealtimeMessageThread blocked={(blockedRows ?? []) as { id: string; reason: string; createdAt: string }[]} bookingId={id} conversationId={conversation.conversationId} currentUserId={user.id} consultantId={conversation.consultantId} otherName={conversation.otherName} initialMessages={conversation.messages}/>
        {query.mensagem && <p className="form-error chat-feedback" role="alert">{chatFeedbackText(query.mensagem)}</p>}
        {canSend
          ? <form action={sendMessageAction.bind(null, conversation.conversationId)} className="message-form"><input type="hidden" name="returnTo" value={here}/><input className="input" name="body" aria-label={`Mensagem para ${conversation.otherName}`} placeholder="Escreva uma mensagem" maxLength={2000} autoComplete="off" required/><button className="button button-dark">Enviar</button></form>
          : notOpenYet
            ? <div className="chat-closed" role="status"><span>Chat abre em {shortDate(chatOpensAt(startsAt))}</span><p>Para manter a conversa na Insidely, o chat abre 24 horas antes do horário marcado e fecha quando a conversa termina.</p></div>
            : <div className="chat-closed" role="status"><span>{chatClosedReason(conversation.status)}</span><p>O chat foi encerrado e ninguém pode mais enviar mensagens. O histórico continua disponível aqui.</p></div>}
      </section>
      {REPORTABLE.includes(conversation.status) && conversation.customerId !== conversation.consultantId && <div className="conversation-safety-row"><span className="conversation-safety-label">Algum problema com {conversation.otherName.split(" ")[0]}?</span><ConversationReportForm bookingId={id} otherName={conversation.otherName} returnTo={here}/><BlockUserForm bookingId={id} otherName={conversation.otherName} returnTo={here}/></div>}
    </div>
  </DashboardShell>;
}
