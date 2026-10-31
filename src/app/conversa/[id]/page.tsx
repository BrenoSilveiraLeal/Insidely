import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmMessageAnswersAction, disputeBookingAction, finishMessageByConsultantAction, concludeMessageAnswersAction, sendMessageAction, sendNextQuestionAction } from "@/app/actions";
import { ChatMessageForm } from "@/components/chat-message-form";
import { BlockUserForm, ConversationReportForm, reportFeedbackText } from "@/components/conversation-safety";
import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingRoomMessage } from "@/components/meeting-room-message";
import { RealtimeMessageThread } from "@/components/realtime-message-thread";
import { StartsIn } from "@/components/starts-in";
import { PrepChecklist } from "@/components/prep-checklist";
import { canSendBookingMessage, chatClosedReason, chatOpensAt, isMessageClosing } from "@/lib/booking-policy";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getBlockedBookingIds } from "@/lib/blocks";
import { chatFeedbackText } from "@/lib/chat-moderation";
import { getConversationForParticipant, markConversationRead } from "@/lib/conversations";
import { markPageNotificationsRead } from "@/lib/nav-badges";
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
  await markPageNotificationsRead(user.id, `/conversa/${id}`);
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
  // After answering the last question (a reply of their own after it) the consultant concludes, which
  // posts Insidely's thank-you, and then finishes. Then the amount stays held 24 hours for the customer to contest.
  const concluded = conversation.messages.some((message) => message.senderId === conversation.customerId && isMessageClosing(message));
  const lastQuestionAt = Math.max(0, ...conversation.messages.filter((message) => message.senderId === conversation.customerId && !isMessageClosing(message)).map((message) => parseDbDate(message.createdAt).getTime()));
  const answeredLast = conversation.messages.some((message) => message.senderId === conversation.consultantId && !message.automatic && parseDbDate(message.createdAt).getTime() > lastQuestionAt);
  const allAnswered = isMessage && conversation.questionsSent >= conversation.questionsTotal && answeredLast;
  const contestUntil = conversation.autoReleaseAt ? parseDbDate(conversation.autoReleaseAt) : null;
  const canContest = isMessage && !consultantMode && conversation.status === "AWAITING_CONFIRMATION" && isFuture(contestUntil);
  return <DashboardShell mode={consultantMode ? "consultant" : "user"} title={`Conversa com ${conversation.otherName}`} activeHref={backHref} canConsultant={user.role === Role.CONSULTANT}>
    <div className="conversation-page">
      <div className="conversation-header"><Link className="text-link" href={backHref}>← Voltar</Link><span className="eyebrow">{bookingStatusLabel(conversation.status)} · {isMessage ? `Perguntas por mensagem · respostas até ${shortDate(new Date(startsAt.getTime() + conversation.durationMinutes * 60_000))}` : `${shortDate(startsAt)} · ${conversation.durationMinutes} min`}</span>{!isMessage && conversation.status === "CONFIRMED" && <StartsIn key={id} startsAt={startsAt.toISOString()} durationMinutes={conversation.durationMinutes}/>}</div>
      {query.bloqueio === "ok" && <p className="form-feedback" role="status">Pessoa bloqueada. Vocês não conseguem mais agendar novas conversas um com o outro.</p>}
      {query.bloqueio === "removido" && <p className="form-feedback" role="status">Bloqueio removido. Vocês voltam a poder agendar conversas.</p>}
      {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
      {!isMessage && conversation.status === "CONFIRMED" && showChecklist(startsAt, conversation.durationMinutes) && <PrepChecklist/>}
      {!isMessage && <MeetingRoomMessage booking={{ id, status: conversation.status, startsAt, durationMinutes: conversation.durationMinutes, meetingUrl: conversation.meetingUrl }} calendarSide={consultantMode ? "consultant" : "customer"}/>}
      {/* The customer only follows the answers (the consultant finishes; afterwards the customer can contest),
          so their bar goes away once the consultant concluded: the closing notice in the chat says what comes next. */}
      {isMessage && conversation.status === "CONFIRMED" && (consultantMode || !concluded) && <section className="panel message-booking-bar">
        <div><strong>Perguntas por mensagem</strong><p className="muted">{consultantMode ? `Responda pelo chat até ${shortDate(new Date(startsAt.getTime() + conversation.durationMinutes * 60_000))}.${conversation.questionsTotal > 1 ? ` Pergunta ${Math.max(1, conversation.questionsSent)} de ${conversation.questionsTotal}: ${conversation.questionsSent < conversation.questionsTotal ? "quando terminar de responder, clique em “Enviar próxima pergunta”." : "todas as perguntas já foram enviadas."}` : ""}` : `${conversation.questionsTotal > 1 ? `Pergunta ${Math.max(1, conversation.questionsSent)} de ${conversation.questionsTotal} enviada${conversation.questionsSent < conversation.questionsTotal ? "; a próxima vai quando o consultor terminar de responder" : ""}` : "Sua pergunta foi enviada"}. As respostas chegam aqui até ${shortDate(new Date(startsAt.getTime() + conversation.durationMinutes * 60_000))}; sem resposta até lá, o valor volta integralmente para você.`}</p></div>
        {/* The consultant releases the next question once they finished answering (a greeting alone does not). */}
        {consultantMode && conversation.questionsSent < conversation.questionsTotal && (answeredLast
          ? <form action={sendNextQuestionAction.bind(null, id)}><button className="button button-dark button-sm">Enviar próxima pergunta</button></form>
          : <small className="muted">Responda a pergunta atual para liberar a próxima.</small>)}
        {consultantMode && conversation.questionsSent >= conversation.questionsTotal && (concluded
          ? <form action={finishMessageByConsultantAction.bind(null, id)}><button className="button button-dark button-sm">Finalizar atendimento</button></form>
          : allAnswered
            ? <form action={concludeMessageAnswersAction.bind(null, id)}><button className="button button-dark button-sm">Concluir respostas</button></form>
            : <small className="muted">Responda a última pergunta para concluir.</small>)}
      </section>}
      {canContest && contestUntil && <section className="panel form-stack message-contest">
        <div><strong>O consultor finalizou o atendimento. Suas perguntas foram respondidas?</strong><p className="muted">O valor fica retido pela Insidely até {shortDate(contestUntil)}. Sem resposta sua até lá, ele segue para o consultor.</p></div>
        {query.contestacao === "curta" && <p className="form-error" role="alert">Descreva o problema com pelo menos 20 caracteres.</p>}
        {query.contestacao === "erro" && <p className="form-error" role="alert">Não foi possível registrar a contestação. Tente de novo.</p>}
        <div className="policy-actions">
          <form action={confirmMessageAnswersAction.bind(null, id)}><button className="button button-accent button-sm">Sim, foram respondidas</button></form>
          <details className="policy-report"><summary className="button button-ghost button-sm">Não foram respondidas</summary>
            <form action={disputeBookingAction.bind(null, id)} className="form-stack"><input type="hidden" name="returnTo" value={`/conversa/${id}`}/><p className="muted">O suporte analisa a conversa e decide: se as perguntas não foram respondidas, ou foram só em parte, você recebe o valor de volta, todo ou em parte.</p><textarea className="textarea" name="description" rows={3} aria-label="O que ficou sem resposta" minLength={20} maxLength={2000} required placeholder="Ex.: A pergunta 2 foi respondida só com “depende” e a 3 não foi respondida."/><button className="button button-dark button-sm">Enviar ao suporte</button></form>
          </details>
        </div>
        <small className="muted">Confirmar encerra o pedido e libera o pagamento ao consultor. Não dá para desfazer.</small>
      </section>}
      {isMessage && query.contestacao === "ok" && <p className="form-feedback" role="status">Contestação enviada. O suporte vai analisar a conversa e você recebe o resultado por notificação.</p>}
      {isMessage && !consultantMode && conversation.status === "DISPUTED" && query.contestacao !== "ok" && <p className="form-feedback" role="status">Sua contestação está com o suporte. O valor continua retido até a análise, e você recebe o resultado por notificação.</p>}
      <section className="panel conversation-panel">
        <RealtimeMessageThread key={conversation.conversationId} blocked={(blockedRows ?? []) as { id: string; reason: string; createdAt: string }[]} bookingId={id} conversationId={conversation.conversationId} currentUserId={user.id} consultantId={conversation.consultantId} otherName={conversation.otherName} initialMessages={conversation.messages} systemNotice={isMessage ? (consultantMode ? `Este é um pedido de “Perguntas por mensagem”, pago para ser respondido aqui no chat, não por vídeo. O cliente já escreveu ${conversation.questionsTotal > 1 ? `${conversation.questionsTotal} perguntas` : "a pergunta"}${conversation.questionsTotal > 1 ? ", e a Insidely envia uma de cada vez: responda à vontade e, quando terminar, clique em “Enviar próxima pergunta”" : ""}. O cliente não envia outras mensagens. Responda até ${shortDate(new Date(startsAt.getTime() + conversation.durationMinutes * 60_000))}; depois da última resposta, clique em “Concluir respostas” e finalize o atendimento. Sem nenhuma resposta no prazo, o valor volta para o cliente.` : `Este é um pedido de “Perguntas por mensagem”. A Insidely envia ${conversation.questionsTotal > 1 ? "suas perguntas ao consultor uma de cada vez: a próxima vai quando ele terminar de responder a anterior" : "sua pergunta ao consultor"}. Você só acompanha por aqui; as respostas chegam até ${shortDate(new Date(startsAt.getTime() + conversation.durationMinutes * 60_000))}.`) : conversation.goals ? `${consultantMode ? "O que o cliente quer conversar" : "O que você quer conversar"}: “${conversation.goals}”` : undefined} closingNotice={isMessage && conversation.status === "CONFIRMED" ? (consultantMode ? `Todas as perguntas foram respondidas. Se não tiver mais nada a acrescentar, clique em “Finalizar atendimento”: o chat é encerrado e o valor fica retido por 24 horas antes do repasse.` : `O consultor respondeu todas as suas perguntas. Quando ele finalizar o atendimento, você terá 24 horas para contestar se alguma resposta não tratou do que você perguntou.`) : undefined}/>
        {query.mensagem && <p className={`${query.mensagem === "encerrada" || query.mensagem === "finalizada" ? "form-feedback" : "form-error"} chat-feedback`} role="alert">{chatFeedbackText(query.mensagem)}</p>}
        {canSend
          ? <ChatMessageForm action={sendMessageAction.bind(null, conversation.conversationId)} returnTo={here} label={`Mensagem para ${conversation.otherName}`}/>
          : questionsUsedUp && conversation.status === "CONFIRMED"
            ? <div className="chat-closed" role="status"><span>Suas perguntas foram enviadas</span><p>Agora é com o consultor: as respostas aparecem aqui. Depois que ele finalizar o atendimento, se alguma pergunta ficou sem resposta, você pode contestar.</p></div>
          : notOpenYet
            ? <div className="chat-closed" role="status"><span>Chat abre em {shortDate(chatOpensAt(startsAt))}</span><p>Para manter a conversa na Insidely, o chat abre 24 horas antes do horário marcado e fecha quando a conversa termina.</p></div>
            : <div className="chat-closed" role="status"><span>{chatClosedReason(conversation.status)}</span><p>O chat foi encerrado e ninguém pode mais enviar mensagens. O histórico continua disponível aqui.</p></div>}
      </section>
      {REPORTABLE.includes(conversation.status) && conversation.customerId !== conversation.consultantId && <div className="conversation-safety-row"><span className="conversation-safety-label">Algum problema com {conversation.otherName.split(" ")[0]}?</span><ConversationReportForm bookingId={id} otherName={conversation.otherName} returnTo={here}/><BlockUserForm bookingId={id} otherName={conversation.otherName} returnTo={here} blocked={blockedHere}/></div>}
    </div>
  </DashboardShell>;
}
