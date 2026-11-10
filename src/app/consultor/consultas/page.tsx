import { CalendarDays, ShieldCheck } from "lucide-react";
import { markPageNotificationsRead } from "@/lib/nav-badges";
import { TwoColumns } from "@/components/two-columns";
import { ConversationLink } from "@/components/conversation-link";
import { getUnreadCounts } from "@/lib/conversations";
import { BlockUserForm, ConversationReportForm, CustomerFeedbackForm, customerFeedbackText, reportFeedbackText } from "@/components/conversation-safety";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { chatFeedbackText } from "@/lib/chat-moderation";
import { cancelBookingAction, confirmConversationAction, disputeBookingAction } from "@/app/actions";
import { getBlockedBookingIds } from "@/lib/blocks";
import { DashboardShell } from "@/components/dashboard-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { Role } from "@/lib/domain";
import { bookingStatusLabel, parseDbDate, shortDate } from "@/lib/format";
import { CHAT_FIRST_ANSWER_HOURS, canReviewBooking, paymentDeadline, holdMinutesFor } from "@/lib/booking-policy";
import { getConsultantBookings, getConsultantMessages } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { getCustomersForConsultant, type ConsultantCustomerInfo } from "@/lib/customer-identity";

export const metadata = { title: "Consultas e mensagens" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; cancelamento?: string; mensagem?: string; contestacao?: string; denuncia?: string; avaliacao?: string; bloqueio?: string }> }) {
  const user = await requireUser([Role.CONSULTANT]);
  // Opening the page counts its notifications as seen (the menu count goes away).
  await markPageNotificationsRead(user.id, "/consultor/consultas");
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const [bookings, messages] = await Promise.all([getConsultantBookings(user.id, page, 10), getConsultantMessages(user.id, 1, 100)]);
  const byConversation = new Map<string, typeof messages.items>();
  for (const message of messages.items) { const list = byConversation.get(message.conversationId) ?? []; list.push(message); byConversation.set(message.conversationId, list); }
  // The RPC returns newest first (for pagination); show each chat oldest to newest.
  for (const list of byConversation.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const blockedBookings = await getBlockedBookingIds(user.id, bookings.items.map((booking) => booking.id));
  // CustomerFeedback is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: feedbackRows } = bookings.items.length ? await (createSupabaseServiceClient() as any).from("CustomerFeedback").select("bookingId").in("bookingId", bookings.items.map((booking) => booking.id)) : { data: [] };
  const rated = new Set((feedbackRows ?? []).map((row: { bookingId: string }) => row.bookingId));
  const unread = await getUnreadCounts(user.id, bookings.items.flatMap((booking) => booking.conversation ? [booking.conversation.id] : []));
  const customers = await getCustomersForConsultant(user.id, bookings.items.filter((booking) => booking.status !== "EXPIRED").map((booking) => booking.id));
  return <DashboardShell mode="consultant" title="Chats"><div className="consultas-feedback">
    {query.mensagem && <p className="form-error" role="alert">{chatFeedbackText(query.mensagem)}</p>}
    {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
    {query.bloqueio && <p className="form-feedback" role="status">{query.bloqueio === "removido" ? "Bloqueio removido. Vocês voltam a poder conversar." : "Pessoa bloqueada. Vocês não conseguem mais abrir novos chats um com o outro."}</p>}
    {query.avaliacao && <p className={query.avaliacao === "ok" ? "form-feedback" : "form-error"} role={query.avaliacao === "ok" ? "status" : "alert"}>{customerFeedbackText(query.avaliacao)}</p>}
    {query.contestacao === "curta" && <p className="form-error" role="alert">Descreva o problema com pelo menos 20 caracteres para abrir a contestação.</p>}{query.contestacao === "erro" && <p className="form-error" role="alert">Não foi possível registrar a contestação. Tente novamente ou fale com o suporte.</p>}{query.contestacao === "ok" && <p className="form-feedback" role="status">Contestação registrada. O suporte vai analisar o caso.</p>}
    {query.cancelamento === "ok" && <p className="form-success" role="status">Chat recusado. O reembolso integral foi iniciado e o cliente foi avisado por e-mail.</p>}
    {query.cancelamento === "motivo" && <p className="form-error" role="alert">Informe um motivo com pelo menos 10 caracteres para cancelar.</p>}
    {query.cancelamento === "erro" && <p className="form-error" role="alert">Não foi possível recusar este chat. Nenhuma alteração foi confirmada; tente novamente ou contate o suporte.</p>}
    </div><TwoColumns key={bookings.page} className="paginated-bookings booking-grid">{bookings.items.map(booking => {
      const info = customers.get(booking.id);
      const paid = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"].includes(booking.status);
      const isChat = booking.format === "MESSAGE";
      // A chat with no answer yet can still be declined (the customer gets 100% back).
      const cancellable = booking.status === "PENDING_PAYMENT" || (booking.status === "CONFIRMED" && (isChat ? !(byConversation.get(booking.conversation?.id ?? "") ?? []).some((message) => message.senderId === user.id) : booking.startsAt > new Date()));
      return <article className="panel booking-card" key={booking.id}>
        <header className="booking-card-top">
          <div className="booking-card-who">
            <h2>{booking.customer.name}</h2>
            {info?.reputation ? <span className={`booking-reputation ${info.reputation.label === "Atenção" ? "reputation-bad" : ""}`}>★ {info.reputation.average.toFixed(1)} · {info.reputation.label}</span> : info ? <span className="booking-reputation booking-reputation-neutral"><ShieldCheck size={13} aria-hidden="true"/> Cliente identificado</span> : null}
          </div>
          <span className="booking-card-chips">{!isChat && <span className="format-chip">Vídeo (antigo)</span>}<span className={`booking-chip booking-chip-${booking.status.toLowerCase()}`}>{bookingStatusLabel(booking.status)}</span></span>
        </header>
        <div className="booking-card-meta"><CalendarDays size={15} aria-hidden="true"/><span>{isChat ? (booking.status === "CONFIRMED" ? `Chat aberto até ${shortDate(new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000))}` : `Chat aberto em ${shortDate(booking.startsAt)}`) : `${shortDate(booking.startsAt)} · ${booking.durationMinutes} min`}</span></div>

        <p className="booking-card-note">{booking.status === "PENDING_PAYMENT" ? `Aguardando pagamento até ${shortDate(paymentDeadline(booking.createdAt, booking.startsAt, booking.durationMinutes, holdMinutesFor(booking.format)))}. O chat abre depois da confirmação.`
          : booking.status === "EXPIRED" ? "Pagamento não concluído a tempo."
          : booking.status === "DISPUTED" ? "Em análise pelo suporte. O repasse fica suspenso até a decisão."
          : isChat && booking.status === "CONFIRMED" ? `Chat aberto: responda pelo chat em até ${CHAT_FIRST_ANSWER_HOURS} horas depois da primeira mensagem do cliente.`
          : booking.status === "AWAITING_CONFIRMATION" ? (booking.consultantConfirmedAt ? "Chat encerrado. O repasse é liberado se o cliente confirmar ou não contestar em 24 horas." : "Confirme que a conversa aconteceu para liberar o repasse.")
          : null}</p>

        <div className="booking-card-actions">
          {booking.conversation && <ConversationLink bookingId={booking.id} unread={unread.get(booking.conversation.id) ?? 0} total={(byConversation.get(booking.conversation.id) ?? []).length}/>}
          {booking.status === "AWAITING_CONFIRMATION" && !booking.consultantConfirmedAt && <form action={confirmConversationAction.bind(null, booking.id)}><button className="button button-accent">Confirmar conversa realizada</button></form>}
        </div>
        {info !== undefined && !rated.has(booking.id) && canReviewBooking(booking.status, booking.startsAt, booking.durationMinutes) && <CustomerFeedbackForm bookingId={booking.id} customerName={booking.customer.name}/>}

        {booking.status !== "EXPIRED" && <details className="booking-card-more">
          <summary>Mais opções</summary>
          <div className="booking-card-more-body">
            {customers.has(booking.id) && <CustomerInfo info={info ?? null}/>}
            {booking.status === "AWAITING_CONFIRMATION" && <form className="booking-card-option" action={disputeBookingAction.bind(null, booking.id)}><strong>Problema com o pagamento ou a conversa?</strong><input type="hidden" name="returnTo" value="/consultor/consultas"/><textarea className="textarea" name="description" aria-label="Descreva o problema" minLength={20} maxLength={2000} required placeholder="Explique para o suporte o que aconteceu."/><button className="button button-ghost button-sm">Abrir contestação</button></form>}
            {paid && customers.has(booking.id) && <div className="conversation-safety-row"><ConversationReportForm bookingId={booking.id} otherName={booking.customer.name} returnTo="/consultor/consultas"/><BlockUserForm bookingId={booking.id} otherName={booking.customer.name} returnTo="/consultor/consultas" blocked={blockedBookings.has(booking.id)}/></div>}
            {cancellable && <details className="cancel-booking-details consultant-cancel-details"><summary><span>Recusar chat</span></summary><div className="cancel-booking-confirmation"><h3>Não pode atender este chat?</h3><p className="muted">O cliente será avisado por e-mail e, se já tiver pago, receberá o valor integral de volta.</p><form action={cancelBookingAction.bind(null, booking.id)} className="form-stack"><label className="field"><span>Motivo</span><textarea className="textarea" name="reason" minLength={10} maxLength={500} required placeholder="Explique brevemente o motivo."/></label><button className="button button-danger button-sm" type="submit">Recusar e devolver o valor</button></form></div></details>}
          </div>
        </details>}
      </article>;
    })}
  </TwoColumns>{!bookings.items.length && <p className="panel muted">Nenhum chat nesta página.</p>}<PaginationControls page={bookings.page} total={bookings.total} pageSize={bookings.pageSize} basePath="/consultor/consultas"/></DashboardShell>;
}

// Basic data about who booked: enough to recognize the person and, if something serious happens,
// to report it. The full record stays with the platform and is handed over only to authorities.
function CustomerInfo({ info }: { info: ConsultantCustomerInfo | null }) {
  const since = (value: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(parseDbDate(value));
  return <details className="customer-info">
    <summary>Dados do cliente{info?.reputation && ` · ★ ${info.reputation.average.toFixed(1)} ${info.reputation.label}`}</summary>
    {info ? <><dl>
      <div><dt>CPF</dt><dd>{info.maskedCpf} <span className="status">Identificado</span></dd></div>
      <div><dt>Idade</dt><dd>{info.age} anos</dd></div>
      <div><dt>Na Insidely desde</dt><dd>{since(info.memberSince)}</dd></div>
      <div><dt>Conversas realizadas</dt><dd>{info.pastConversations}</dd></div>
    </dl>
      {info.reputation ? <div className="form-stack"><div className="reputation"><span className="reputation-stars">★ {info.reputation.average.toFixed(1)}</span><span className="muted">({info.reputation.count} {info.reputation.count === 1 ? "avaliação" : "avaliações"} de consultores)</span><span className={`status ${info.reputation.label === "Atenção" ? "reputation-bad" : "reputation-good"}`}>{info.reputation.label}</span></div>{info.reputation.recent.map((item, index) => <p className="muted" key={index}>★ {item.rating} · “{item.comment}”</p>)}</div> : <p className="muted">Ainda sem avaliações de outros consultores.</p>}</> : <p className="muted">Agendamento anterior à identificação obrigatória: este cliente ainda não registrou CPF.</p>}
    <p className="muted">Se algo grave acontecer na conversa, use o botão &quot;Denunciar&quot; ou o <a className="text-link" href="/suporte">suporte</a>. A Insidely guarda a identificação completa e a entrega às autoridades mediante requisição legal.</p>
  </details>;
}
