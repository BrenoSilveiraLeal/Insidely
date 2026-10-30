import Link from "next/link";
import { notFound } from "next/navigation";
import { sendMessageAction } from "@/app/actions";
import { ConversationReportForm, reportFeedbackText } from "@/components/conversation-safety";
import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingRoomMessage } from "@/components/meeting-room-message";
import { RealtimeMessageThread } from "@/components/realtime-message-thread";
import { canSendBookingMessage } from "@/lib/booking-policy";
import { chatFeedbackText } from "@/lib/chat-moderation";
import { getConversationForParticipant, markConversationRead } from "@/lib/conversations";
import { Role } from "@/lib/domain";
import { bookingStatusLabel, parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Conversa" };
export const dynamic = "force-dynamic";

const REPORTABLE = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"];

// One conversation on its own page, so a long history never stretches the booking cards.
export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mensagem?: string; denuncia?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireUser([Role.USER, Role.CONSULTANT], { nextPath: `/conversa/${id}` });
  const conversation = await getConversationForParticipant(id, user.id);
  if (!conversation) notFound();
  await markConversationRead(conversation.conversationId, user.id);
  const consultantMode = conversation.viewerIsConsultant && user.role === Role.CONSULTANT;
  const backHref = consultantMode ? "/consultor/consultas" : "/dashboard/mensagens";
  const here = `/conversa/${id}`;
  const startsAt = parseDbDate(conversation.startsAt);
  return <DashboardShell mode={consultantMode ? "consultant" : "user"} title={`Conversa com ${conversation.otherName}`} canConsultant={user.role === Role.CONSULTANT}>
    <div className="conversation-page">
      <div className="conversation-header"><Link className="text-link" href={backHref}>← Voltar</Link><span className="eyebrow">{bookingStatusLabel(conversation.status)} · {shortDate(startsAt)} · {conversation.durationMinutes} min</span></div>
      {query.mensagem && <p className="form-error" role="alert">{chatFeedbackText(query.mensagem)}</p>}
      {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
      <MeetingRoomMessage booking={{ id, status: conversation.status, startsAt, durationMinutes: conversation.durationMinutes, meetingUrl: conversation.meetingUrl }} calendarSide={consultantMode ? "consultant" : "customer"}/>
      <section className="panel conversation-panel">
        <RealtimeMessageThread bookingId={id} conversationId={conversation.conversationId} currentUserId={user.id} consultantId={conversation.consultantId} otherName={conversation.otherName} initialMessages={conversation.messages}/>
        {canSendBookingMessage(conversation.status)
          ? <form action={sendMessageAction.bind(null, conversation.conversationId)} className="message-form"><input type="hidden" name="returnTo" value={here}/><input className="input" name="body" aria-label={`Mensagem para ${conversation.otherName}`} placeholder="Escreva uma mensagem" maxLength={2000} autoComplete="off" required/><button className="button button-dark">Enviar</button></form>
          : <p className="muted">O envio de mensagens está encerrado para esta conversa. O histórico continua disponível.</p>}
      </section>
      {REPORTABLE.includes(conversation.status) && conversation.customerId !== conversation.consultantId && <ConversationReportForm bookingId={id} otherName={conversation.otherName} returnTo={here}/>}
    </div>
  </DashboardShell>;
}
