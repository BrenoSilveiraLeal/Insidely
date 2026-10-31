import Link from "next/link";
import { notFound } from "next/navigation";
import { disputeBookingAction, finishMessageBookingAction, finishMessageByConsultantAction, sendMessageAction } from "@/app/actions";
import { BlockUserForm, ConversationReportForm, reportFeedbackText } from "@/components/conversation-safety";
import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingRoomMessage } from "@/components/meeting-room-message";
import { RealtimeMessageThread } from "@/components/realtime-message-thread";
import { StartsIn } from "@/components/starts-in";
import { PrepChecklist } from "@/components/prep-checklist";
import { canSendBookingMessage, chatClosedReason, chatOpensAt } from "@/lib/booking-policy";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getBlockedBookingIds } from "@/lib/blocks";
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

function isFuture(date: Date | null) {
  return date !== null && date.getTime() > Date.now();
}

const REPORTABLE = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"];

// One conversation on its own page, so a long history never stretches the booking cards.
export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mensagem?: string; denuncia?: string; bloqueio?: string; contestacao?: string }> }) {
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
  const blockedHere = (await getBlockedBookingIds(user.id, [id])).has(id);
  const isMessage = conversation.format === "MESSAGE";
  // In a message booking the customer's messages are the questions sent with the request (up to
  // MESSAGE_QUESTION_LIMIT, posted when paid); the consultant answers freely.
  const questionsUsedUp = isMessage && conversation.viewerIsConsultant === false;
  const canSend = canSendBookingMessage(conversation.status, startsAt, conversation.durationMinutes) && !questionsUsedUp;
  const notOpenYet = conversation.status === "CONFIRMED" && chatNotOpenYet(startsAt);
  // The consultant can finish only after answering the last question (a reply of their own after the
  // last question the system sent). Then the amount stays held 24 hours for the customer to contest.
  const lastQuestionAt = Math.max(0, ...conversation.messages.filter((message) => message.senderId === conversation.customerId).map((message) => parseDbDate(message.createdAt).getTime()));
  const answeredLast = conversation.messages.some((message) => message.senderId === conversation.consultantId && !message.automatic && parseDbDate(message.createdAt).getTime() > lastQuestionAt);
  const allAnswered = isMessage && conversation.questionsSent >= conversation.questionsTotal && answeredLast;
  const contestUntil = conversation.autoReleaseAt ? parseDbDate(conversation.autoReleaseAt) : null;
  const canContest = isMessage && !consultantMode && conversation.status === "AWAITING_CONFIRMATION" && isFuture(contestUntil);
  return <DashboardShell mode={consultantMode ? "consultant" : "user"} title={`Conversa com ${conversation.otherName}`} canConsultant={user.role === Role.CONSULTANT}>
    <div className="conversation-page">
      <div className="conversation-header"><Link className="text-link" href={backHref}>← Voltar</Link><span className="eyebrow">{bookingStatusLabel(conversation.status)} · {isMessage ? `Perguntas por mensagem · respostas até ${shortDate(new Date(startsAt.getTime() + conversation.durationMinutes * 60_000))}` : `${shortDate(startsAt)} · ${conversation.durationMinutes} min`}</span>{conversation.status === "CONFIRMED" && <StartsIn startsAt={startsAt.toISOString()} durationMinutes={conversation.durationMinutes}/>}</div>
      {query.bloqueio === "ok" && <p className="form-feedback" role="status">Pessoa bloqueada. Vocês não conseguem mais agendar novas conversas um com o outro.</p>}
      {query.bloqueio === "removido" && <p className="form-feedback" role="status">Bloqueio removido. Vocês voltam a poder agendar conversas.</p>}
      {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
      {!isMessage && conversation.status === "CONFIRMED" && showChecklist(startsAt, conversation.durationMinutes) && <PrepChecklist/>}
      {!isMessage && <MeetingRoomMessage booking={{ id, status: conversation.status, startsAt, durationMinutes: conversation.durationMinutes, meetingUrl: conversation.meetingUrl }} calendarSide={consultantMode ? "consultant" : "customer"}/>}
      {isMessage && conversation.status === "CONFIRMED" && <section className="panel message-booking-bar">
        <div><strong>Perguntas por mensagem</strong><p className="muted">{consultantMode ? `Responda pelo chat até ${shortDate(new Date(startsAt.getTime() + conversation.durationMinutes * 60_000))}.${conversation.questionsTotal > 1 ? ` Pergunta ${Math.max(1, conversation.questionsSent)} de ${conversation.questionsTotal}: ${conversation.questionsSent < conversation.questionsTotal ? "quando você responder, a próxima é enviada automaticamente pela Insidely." : "todas as perguntas já foram enviadas."}` : ""}` : `${conversation.questionsTotal > 1 ? `Pergunta ${Math.max(1, conversation.questionsSent)} de ${conversation.questionsTotal} enviada${conversation.questionsSent < conversation.questionsTotal ? "; a próxima vai quando o consultor responder" : ""}` : "Sua pergunta foi enviada"}. As respostas chegam aqui até ${shortDate(new Date(startsAt.getTime() + conversation.durationMinutes * 60_000))}; sem resposta até lá, o valor volta integralmente para você.`}</p></div>
        {!consultantMode && <form action={finishMessageBookingAction.bind(null, id)}><button className="button button-ghost button-sm">Minhas dúvidas foram respondidas</button></form>}
        {consultantMode && (allAnswered ? <form action={finishMessageByConsultantAction.bind(null, id)}><button className="button button-dark button-sm">Finalizar atendimento</button></form> : <small className="muted">“Finalizar atendimento” aparece depois que você responder a última pergunta.</small>)}
      </section>}
      {canContest && contestUntil && <section className="panel form-stack message-contest">
        <div><strong>O consultor finalizou o atendimento.</strong><p className="muted">O valor fica retido pela Insidely até {shortDate(contestUntil)}. Se as respostas não responderam às suas perguntas, conteste até lá: o suporte analisa a conversa e, se você tiver razão, o valor volta para você.</p></div>
        {query.contestacao === "curta" && <p className="form-error" role="alert">Descreva o problema com pelo menos 20 caracteres.</p>}
        {query.contestacao === "erro" && <p className="form-error" role="alert">Não foi possível registrar a contestação. Tente de novo.</p>}
        <details><summary className="button button-ghost button-sm">As respostas não responderam minhas perguntas</summary>
          <form action={disputeBookingAction.bind(null, id)} className="form-stack"><input type="hidden" name="returnTo" value={`/conversa/${id}`}/><textarea className="textarea" name="description" rows={3} minLength={20} maxLength={2000} required placeholder="Ex.: A pergunta 2 foi respondida só com “depende” e a 3 não foi respondida."/><button className="button button-dark button-sm">Enviar contestação</button></form>
        </details>
      </section>}
      {isMessage && query.contestacao === "ok" && <p className="form-feedback" role="status">Contestação enviada. O suporte vai analisar a conversa e você recebe o resultado por notificação.</p>}
      <section className="panel conversation-panel">
        <RealtimeMessageThread blocked={(blockedRows ?? []) as { id: string; reason: string; createdAt: string }[]} bookingId={id} conversationId={conversation.conversationId} currentUserId={user.id} consultantId={conversation.consultantId} otherName={conversation.otherName} initialMessages={conversation.messages}/>
        {query.mensagem && <p className={`${query.mensagem === "encerrada" ? "form-feedback" : "form-error"} chat-feedback`} role="alert">{chatFeedbackText(query.mensagem)}</p>}
        {canSend
          ? <form action={sendMessageAction.bind(null, conversation.conversationId)} className="message-form"><input type="hidden" name="returnTo" value={here}/><input className="input" name="body" aria-label={`Mensagem para ${conversation.otherName}`} placeholder="Escreva uma mensagem" maxLength={2000} autoComplete="off" required/><button className="button button-dark">Enviar</button></form>
          : questionsUsedUp && conversation.status === "CONFIRMED"
            ? <div className="chat-closed" role="status"><span>Suas perguntas foram enviadas</span><p>Agora é com o consultor: as respostas aparecem aqui. Quando suas dúvidas forem respondidas, encerre o pedido.</p></div>
          : notOpenYet
            ? <div className="chat-closed" role="status"><span>Chat abre em {shortDate(chatOpensAt(startsAt))}</span><p>Para manter a conversa na Insidely, o chat abre 24 horas antes do horário marcado e fecha quando a conversa termina.</p></div>
            : <div className="chat-closed" role="status"><span>{chatClosedReason(conversation.status)}</span><p>O chat foi encerrado e ninguém pode mais enviar mensagens. O histórico continua disponível aqui.</p></div>}
      </section>
      {REPORTABLE.includes(conversation.status) && conversation.customerId !== conversation.consultantId && <div className="conversation-safety-row"><span className="conversation-safety-label">Algum problema com {conversation.otherName.split(" ")[0]}?</span><ConversationReportForm bookingId={id} otherName={conversation.otherName} returnTo={here}/><BlockUserForm bookingId={id} otherName={conversation.otherName} returnTo={here} blocked={blockedHere}/></div>}
    </div>
  </DashboardShell>;
}
