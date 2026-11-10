import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff } from "lucide-react";
import { confirmMessageAnswersAction, customerCancelBookingAction, disputeBookingAction, finishMessageByConsultantAction, sendMessageAction } from "@/app/actions";
import { ChatMessageForm } from "@/components/chat-message-form";
import { ChoiceWithReport } from "@/components/choice-with-report";
import { BlockUserForm, ConversationReportForm, reportFeedbackText } from "@/components/conversation-safety";
import { DashboardShell } from "@/components/dashboard-shell";
import { RealtimeMessageThread } from "@/components/realtime-message-thread";
import { CHAT_FIRST_ANSWER_HOURS, CHAT_IDLE_HOURS, canSendBookingMessage, chatClosedReason } from "@/lib/booking-policy";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getBlockedBookingIds } from "@/lib/blocks";
import { chatFeedbackText } from "@/lib/chat-moderation";
import { getConversationForParticipant, markConversationRead } from "@/lib/conversations";
import { markPageNotificationsRead } from "@/lib/nav-badges";
import { Role } from "@/lib/domain";
import { bookingStatusLabel, initials, parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Conversa" };
export const dynamic = "force-dynamic";

function isFuture(date: Date | null) {
  return date !== null && date.getTime() > Date.now();
}

const REPORTABLE = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"];
const HOUR = 60 * 60_000;

// One chat on its own page. Rules (lib/booking-policy.ts): the consultant has 24 hours for the first
// answer (or the customer is refunded); then both write freely until the customer says the questions
// were answered, the consultant ends it, 24 hours pass with nobody writing or 72 hours since it opened.
export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mensagem?: string; denuncia?: string; bloqueio?: string; contestacao?: string; cancelamento?: string; advertencia?: string }> }) {
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
  const open = isMessage && conversation.status === "CONFIRMED";
  const canSend = isMessage && canSendBookingMessage(conversation.status, startsAt, conversation.durationMinutes);
  const answered = conversation.messages.some((message) => message.senderId === conversation.consultantId && !message.automatic);
  // The consultant's 24 hours count from the customer's first message (the customer pays first and
  // writes afterwards); with no message yet, nothing is counting.
  const firstQuestion = conversation.messages.find((message) => message.senderId === conversation.customerId);
  const firstAnswerUntil = firstQuestion ? new Date(parseDbDate(firstQuestion.createdAt).getTime() + CHAT_FIRST_ANSWER_HOURS * HOUR) : null;
  const chatUntil = new Date(startsAt.getTime() + conversation.durationMinutes * 60_000);
  const contestUntil = conversation.autoReleaseAt ? parseDbDate(conversation.autoReleaseAt) : null;
  const canContest = isMessage && !consultantMode && conversation.status === "AWAITING_CONFIRMATION" && isFuture(contestUntil);
  const otherFirstName = conversation.otherName.split(" ")[0];
  return <DashboardShell mode={consultantMode ? "consultant" : "user"} title={`Conversa com ${conversation.otherName}`} activeHref={backHref} canConsultant={user.role === Role.CONSULTANT}>
    <div className="conversation-page">
      <div className="conversation-header">
        <Link className="text-link" href={backHref}>← Voltar</Link>
        <div className="conversation-person">
          {conversation.otherImage
            ? <span className="conversation-avatar avatar-photo" style={{ backgroundImage: `url(${conversation.otherImage})` }} aria-hidden="true"/>
            : <span className="conversation-avatar" aria-hidden="true">{!consultantMode && conversation.consultantAnonymous ? <EyeOff size={18}/> : initials(conversation.otherName)}</span>}
          <div><strong>{conversation.otherName}</strong><span className="eyebrow">{bookingStatusLabel(conversation.status)}{open ? ` · chat aberto até ${shortDate(chatUntil)}` : ""}</span></div>
        </div>
      </div>
      {query.bloqueio === "ok" && <p className="form-feedback" role="status">Pessoa bloqueada. Vocês não conseguem mais abrir novos chats um com o outro.</p>}
      {query.bloqueio === "removido" && <p className="form-feedback" role="status">Bloqueio removido. Vocês voltam a poder conversar.</p>}
      {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
      {consultantMode && conversation.consultantAnonymous && open && <p className="section-note chat-anonymity-note"><strong>Você está no modo anônimo.</strong> Evite contar detalhes que identifiquem você: nome do seu gestor, projetos específicos, datas exatas ou o nome do seu time.</p>}
      {open && <section className="panel message-booking-bar">
        <div><strong>{answered ? "Conversa em andamento" : !firstQuestion ? (consultantMode ? "Aguardando a primeira mensagem do cliente" : "Chat aberto: escreva sua primeira mensagem") : consultantMode ? "Responda para começar" : "Aguardando a primeira resposta"}</strong><p className="muted">{answered
          ? (consultantMode ? `Converse à vontade até ${shortDate(chatUntil)}. Se o chat ficar ${CHAT_IDLE_HOURS} horas sem mensagens, ele fecha sozinho. Quando terminar, clique em “Encerrar conversa”.` : `Pergunte à vontade até ${shortDate(chatUntil)}. Quando suas dúvidas forem respondidas, encerre o chat: o pagamento só vai para o consultor nesse momento.`)
          : !firstQuestion || !firstAnswerUntil
            ? (consultantMode ? `O cliente já pagou. Quando ele escrever, você terá ${CHAT_FIRST_ANSWER_HOURS} horas para responder. Se quiser, mande uma saudação.` : `Conte quem você é e o que quer saber. O consultor tem ${CHAT_FIRST_ANSWER_HOURS} horas para responder depois da sua primeira mensagem; sem resposta, o valor volta integralmente para você.`)
            : (consultantMode ? `Envie a primeira resposta até ${shortDate(firstAnswerUntil)}. Sem resposta até lá, o valor volta para o cliente e o chat é encerrado.` : `O consultor tem até ${shortDate(firstAnswerUntil)} para responder. Sem resposta até lá, o valor volta integralmente para você.`)}</p></div>
        {consultantMode && answered && <form action={finishMessageByConsultantAction.bind(null, id)}><button className="button button-dark button-sm">Encerrar conversa</button></form>}
        {!consultantMode && answered && <form action={confirmMessageAnswersAction.bind(null, id)}><button className="button button-accent button-sm">Minhas dúvidas foram respondidas</button></form>}
      </section>}
      {open && !consultantMode && !answered && <details className="cancel-booking-details"><summary><span>Cancelar chat</span></summary><div className="cancel-booking-confirmation"><h3>Mudou de ideia?</h3><p className="muted">Enquanto o consultor não responde, você pode cancelar e recebe o valor integral de volta. Depois da primeira resposta, não dá mais para cancelar: se algo não for respondido, você contesta quando o chat fechar.</p><form action={customerCancelBookingAction.bind(null, id)} className="form-stack"><input type="hidden" name="returnTo" value={here}/><label className="field"><span>Motivo (opcional)</span><textarea className="textarea" name="reason" maxLength={300} placeholder="Ex.: Já encontrei a resposta que precisava."/></label><button className="button button-danger button-sm">Cancelar e receber o valor de volta</button></form></div></details>}
      {query.cancelamento === "ok" && <p className="form-feedback" role="status">Chat cancelado. Se você já tinha pago, o valor integral será devolvido.</p>}
      {query.cancelamento === "respondido" && <p className="form-error" role="alert">O consultor já respondeu, então o chat não pode mais ser cancelado. Se suas dúvidas não forem respondidas, conteste quando o chat fechar.</p>}
      {query.cancelamento === "erro" && <p className="form-error" role="alert">Não foi possível cancelar agora. Tente novamente ou fale com o suporte.</p>}
      {canContest && contestUntil && <section className="panel form-stack message-contest">
        <div><strong>O chat foi encerrado. Suas dúvidas foram respondidas?</strong><p className="muted">O valor fica retido pela Insidely até {shortDate(contestUntil)}. Sem resposta sua até lá, ele segue para o consultor.</p></div>
        {query.contestacao === "curta" && <p className="form-error" role="alert">Descreva o problema com pelo menos 20 caracteres.</p>}
        {query.contestacao === "erro" && <p className="form-error" role="alert">Não foi possível registrar a contestação. Tente de novo.</p>}
        <ChoiceWithReport confirm={<form action={confirmMessageAnswersAction.bind(null, id)}><button className="button button-accent button-sm">Sim, foram respondidas</button></form>} reportLabel="Não foram respondidas">
            <form action={disputeBookingAction.bind(null, id)} className="form-stack"><input type="hidden" name="returnTo" value={here}/><p className="muted">O suporte analisa a conversa e decide: se suas dúvidas não foram respondidas, ou foram só em parte, você recebe o valor de volta, todo ou em parte.</p><textarea className="textarea" name="description" rows={3} aria-label="O que ficou sem resposta" minLength={20} maxLength={2000} required placeholder="Ex.: Perguntei sobre o processo seletivo e o consultor parou de responder."/><button className="button button-dark button-sm">Enviar ao suporte</button></form>
        </ChoiceWithReport>
        <small className="muted">Confirmar encerra o pedido e libera o pagamento ao consultor. Não dá para desfazer.</small>
      </section>}
      {isMessage && query.contestacao === "ok" && <p className="form-feedback" role="status">Contestação enviada. O suporte vai analisar a conversa e você recebe o resultado por notificação.</p>}
      {isMessage && !consultantMode && conversation.status === "DISPUTED" && query.contestacao !== "ok" && <p className="form-feedback" role="status">Sua contestação está com o suporte. O valor continua retido até a análise, e você recebe o resultado por notificação.</p>}
      <section className="panel conversation-panel">
        <RealtimeMessageThread key={conversation.conversationId} blocked={(blockedRows ?? []) as { id: string; reason: string; createdAt: string }[]} bookingId={id} conversationId={conversation.conversationId} currentUserId={user.id} consultantId={conversation.consultantId} otherName={conversation.otherName} initialMessages={conversation.messages} systemNotice={isMessage
          ? (consultantMode ? `Chat pago pelo cliente. Responda em até ${CHAT_FIRST_ANSWER_HOURS} horas depois da primeira mensagem dele. Fale da sua vivência, sem informações confidenciais.` : "Converse por aqui com calma. Contatos e combinações por fora da Insidely são bloqueados, para proteger os dois lados.")
          : "Conversa antiga, feita por vídeo. As conversas da Insidely agora são só por chat."}/>
        {query.mensagem && <p className={`${query.mensagem === "encerrada" || query.mensagem === "finalizada" ? "form-feedback" : "form-error"} chat-feedback`} role="alert">{chatFeedbackText(query.mensagem)}</p>}
        {query.advertencia && <p className="form-error chat-feedback" role="alert">Você recebeu uma advertência automática por essa tentativa. Novas tentativas nas próximas 24 horas não geram outra advertência, mas continuam bloqueadas. Se achar que foi injusta, <a className="text-link" href="/dashboard/advertencias">recorra aqui</a>.</p>}
        {canSend
          ? <ChatMessageForm action={sendMessageAction.bind(null, conversation.conversationId)} returnTo={here} label={`Mensagem para ${conversation.otherName}`}/>
          : <div className="chat-closed" role="status"><span>{chatClosedReason(conversation.status)}</span><p>O chat foi encerrado e ninguém pode mais enviar mensagens. O histórico continua disponível aqui.</p></div>}
      </section>
      {REPORTABLE.includes(conversation.status) && conversation.customerId !== conversation.consultantId && <div className="conversation-safety-row"><span className="conversation-safety-label">Algum problema com {otherFirstName}?</span><ConversationReportForm bookingId={id} otherName={conversation.otherName} returnTo={here}/><BlockUserForm bookingId={id} otherName={conversation.otherName} returnTo={here} blocked={blockedHere}/></div>}
    </div>
  </DashboardShell>;
}
