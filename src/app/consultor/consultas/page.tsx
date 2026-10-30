import { ConversationLink } from "@/components/conversation-link";
import { getUnreadCounts } from "@/lib/conversations";
import { ConversationReportForm, CustomerFeedbackForm, customerFeedbackText, reportFeedbackText } from "@/components/conversation-safety";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { chatFeedbackText } from "@/lib/chat-moderation";
import { cancelBookingAction, completeBookingAction, confirmConversationAction, disputeBookingAction, updateConsultantRecordingConsentAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingRoomMessage } from "@/components/meeting-room-message";
import { PaginationControls } from "@/components/pagination-controls";
import { Role } from "@/lib/domain";
import { bookingStatusLabel, meetingRoomOpeningText, parseDbDate, shortDate } from "@/lib/format";
import { canReviewBooking, meetingRoomState, paymentDeadline } from "@/lib/booking-policy";
import { getConsultantBookings, getConsultantMessages } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { GoogleCalendarFeedback } from "@/components/google-calendar-feedback";
import { getCustomersForConsultant, type ConsultantCustomerInfo } from "@/lib/customer-identity";

export const metadata = { title: "Consultas e mensagens" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; cancelamento?: string; mensagem?: string; contestacao?: string; calendar?: string; denuncia?: string; avaliacao?: string }> }) {
  const user = await requireUser([Role.CONSULTANT]);
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const [bookings, messages] = await Promise.all([getConsultantBookings(user.id, page, 10), getConsultantMessages(user.id, 1, 100)]);
  const byConversation = new Map<string, typeof messages.items>();
  for (const message of messages.items) { const list = byConversation.get(message.conversationId) ?? []; list.push(message); byConversation.set(message.conversationId, list); }
  // The RPC returns newest first (for pagination); show each chat oldest to newest.
  for (const list of byConversation.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const roomStates = new Map(bookings.items.map((booking) => [booking.id, meetingRoomState(booking.startsAt, booking.durationMinutes)]));
  // CustomerFeedback is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: feedbackRows } = bookings.items.length ? await (createSupabaseServiceClient() as any).from("CustomerFeedback").select("bookingId").in("bookingId", bookings.items.map((booking) => booking.id)) : { data: [] };
  const rated = new Set((feedbackRows ?? []).map((row: { bookingId: string }) => row.bookingId));
  const unread = await getUnreadCounts(user.id, bookings.items.flatMap((booking) => booking.conversation ? [booking.conversation.id] : []));
  const customers = await getCustomersForConsultant(user.id, bookings.items.filter((booking) => booking.status !== "EXPIRED").map((booking) => booking.id));
  return <DashboardShell mode="consultant" title="Consultas e solicitações"><GoogleCalendarFeedback code={query.calendar}/><div className="grid grid-2">
    {query.mensagem && <p className="form-error" role="alert">{chatFeedbackText(query.mensagem)}</p>}
    {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
    {query.avaliacao && <p className={query.avaliacao === "ok" ? "form-feedback" : "form-error"} role={query.avaliacao === "ok" ? "status" : "alert"}>{customerFeedbackText(query.avaliacao)}</p>}
    {query.contestacao === "curta" && <p className="form-error" role="alert">Descreva o problema com pelo menos 20 caracteres para abrir a contestação.</p>}{query.contestacao === "erro" && <p className="form-error" role="alert">Não foi possível registrar a contestação. Tente novamente ou fale com o suporte.</p>}{query.contestacao === "ok" && <p className="form-feedback" role="status">Contestação registrada. O suporte vai analisar o caso.</p>}
    {query.cancelamento === "ok" && <p className="form-success" role="status">Conversa cancelada. O reembolso integral foi iniciado e o cliente foi avisado por e-mail.</p>}
    {query.cancelamento === "motivo" && <p className="form-error" role="alert">Informe um motivo com pelo menos 10 caracteres para cancelar.</p>}
    {query.cancelamento === "erro" && <p className="form-error" role="alert">Não foi possível cancelar esta conversa. Nenhuma alteração foi confirmada; tente novamente ou contate o suporte.</p>}
    {bookings.items.map(booking => <article className="panel" key={booking.id}>
      <span className="eyebrow">{bookingStatusLabel(booking.status)} · {shortDate(booking.startsAt)}</span><h2>{booking.customer.name}</h2><p>{booking.goals}</p>
      {customers.has(booking.id) && <CustomerInfo info={customers.get(booking.id) ?? null}/>}
      {booking.status === "PENDING_PAYMENT" && <div className="meeting-policy compact"><strong>Pedido ainda não pago</strong><p>A conversa e as mensagens serão liberadas após a confirmação do pagamento.</p></div>}
      {booking.status === "PENDING_PAYMENT" && <p className="muted">Aguardando pagamento até {shortDate(paymentDeadline(booking.createdAt, booking.startsAt, booking.durationMinutes))}.</p>}
      {booking.status === "EXPIRED" && <p className="muted">Pagamento não concluído a tempo. O horário foi liberado; este registro permanece no histórico.</p>}
      {booking.status === "CONFIRMED" && booking.startsAt <= new Date() && <form action={completeBookingAction.bind(null, booking.id)}><button className="button button-dark button-sm">Informar fim da conversa</button></form>}
      {booking.status === "AWAITING_CONFIRMATION" && <div className="meeting-policy compact"><strong>Confirmação dupla</strong><p>{booking.consultantConfirmedAt ? "Você confirmou. Aguardando a outra pessoa ou o prazo automático." : "Confirme que a conversa aconteceu para agilizar a liberação."}</p>{!booking.consultantConfirmedAt && <form action={confirmConversationAction.bind(null, booking.id)}><button className="button button-accent button-sm">Confirmar conversa realizada</button></form>}<form className="form-stack" style={{ marginTop: 12 }} action={disputeBookingAction.bind(null, booking.id)}><input type="hidden" name="returnTo" value="/consultor/consultas"/><textarea className="textarea" name="description" aria-label="Descreva o problema" minLength={20} maxLength={2000} required placeholder="Houve algum problema? Explique para o suporte."/><button className="button button-ghost button-sm">Reportar problema</button></form></div>}
      {booking.status === "DISPUTED" && <p className="form-error">O repasse está suspenso até a análise do suporte.</p>}
      {(["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && booking.startsAt > new Date()) && <details className="cancel-booking-details consultant-cancel-details"><summary><span>Cancelar conversa</span></summary><div className="cancel-booking-confirmation"><h3>Precisa cancelar esta conversa?</h3><p className="muted">O cliente será avisado por e-mail e, se já tiver pago, receberá o valor integral de volta.</p><form action={cancelBookingAction.bind(null, booking.id)} className="form-stack"><label className="field"><span>Motivo do cancelamento</span><textarea className="textarea" name="reason" minLength={10} maxLength={500} required placeholder="Explique brevemente o motivo do cancelamento."/></label><button className="button button-danger button-sm" type="submit">Confirmar cancelamento</button></form></div></details>}
      {booking.status === "PENDING_PAYMENT" && <div className="meeting-policy compact"><strong>Sala da conversa</strong><p>A sala será preparada depois da confirmação do pagamento.</p></div>}
      {booking.status === "CONFIRMED" && roomStates.get(booking.id) === "upcoming" && <p className="muted">{meetingRoomOpeningText(booking.startsAt)}</p>}
      {booking.status === "CONFIRMED" && <form action={updateConsultantRecordingConsentAction.bind(null, booking.id)} className="consent-inline"><label><input name="recordingConsent" type="checkbox" defaultChecked={booking.consultantRecordingConsent}/><span>Autorizo a gravação apenas se o participante também aceitar.</span></label><button className="button button-ghost button-sm">Salvar</button></form>}
      <MeetingRoomMessage booking={booking} calendarSide="consultant" />
      {customers.get(booking.id) !== undefined && !rated.has(booking.id) && canReviewBooking(booking.status, booking.startsAt, booking.durationMinutes) && <CustomerFeedbackForm bookingId={booking.id} customerName={booking.customer.name}/>}
      {["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"].includes(booking.status) && customers.has(booking.id) && <ConversationReportForm bookingId={booking.id} otherName={booking.customer.name} returnTo="/consultor/consultas"/>}
      {booking.conversation && <ConversationLink bookingId={booking.id} unread={unread.get(booking.conversation.id) ?? 0} total={(byConversation.get(booking.conversation.id) ?? []).length}/>}
    </article>)}
  </div>{!bookings.items.length && <p className="panel muted">Nenhuma consulta nesta página.</p>}<PaginationControls page={bookings.page} total={bookings.total} pageSize={bookings.pageSize} basePath="/consultor/consultas"/></DashboardShell>;
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
