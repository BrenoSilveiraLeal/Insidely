import { chatFeedbackText } from "@/lib/chat-moderation";
import { cancelBookingAction, completeBookingAction, confirmConversationAction, disputeBookingAction, sendMessageAction, updateConsultantRecordingConsentAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { MeetingRoomMessage } from "@/components/meeting-room-message";
import { PaginationControls } from "@/components/pagination-controls";
import { Role } from "@/lib/domain";
import { bookingStatusLabel, meetingRoomOpeningText, parseDbDate, shortDate } from "@/lib/format";
import { meetingRoomState, paymentDeadline } from "@/lib/booking-policy";
import { getConsultantBookings, getConsultantMessages } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { canSendBookingMessage } from "@/lib/booking-policy";
import { GoogleCalendarFeedback } from "@/components/google-calendar-feedback";
import { getCustomersForConsultant, type ConsultantCustomerInfo } from "@/lib/customer-identity";

export const metadata = { title: "Consultas e mensagens" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; cancelamento?: string; mensagem?: string; contestacao?: string; calendar?: string }> }) {
  const user = await requireUser([Role.CONSULTANT]);
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const [bookings, messages] = await Promise.all([getConsultantBookings(user.id, page, 10), getConsultantMessages(user.id, 1, 100)]);
  const byConversation = new Map<string, typeof messages.items>();
  for (const message of messages.items) { const list = byConversation.get(message.conversationId) ?? []; list.push(message); byConversation.set(message.conversationId, list); }
  // The RPC returns newest first (for pagination); show each chat oldest to newest.
  for (const list of byConversation.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const roomStates = new Map(bookings.items.map((booking) => [booking.id, meetingRoomState(booking.startsAt, booking.durationMinutes)]));
  const customers = await getCustomersForConsultant(user.id, bookings.items.filter((booking) => booking.status !== "EXPIRED").map((booking) => booking.id));
  return <DashboardShell mode="consultant" title="Consultas e solicitações"><GoogleCalendarFeedback code={query.calendar}/><div className="grid grid-2">
    {query.mensagem && <p className="form-error" role="alert">{chatFeedbackText(query.mensagem)}</p>}
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
      {booking.conversation && <><div className="message-thread">{(byConversation.get(booking.conversation.id) ?? []).map(message => <div key={message.id} className={`message ${message.senderId === user.id ? "message-own" : ""}`}><small>{message.sender.name}</small><br/>{message.body}</div>)}</div>{canSendBookingMessage(booking.status) ? <form action={sendMessageAction.bind(null, booking.conversation.id)} className="message-form"><input type="hidden" name="returnTo" value="/consultor/consultas"/><input className="input" name="body" aria-label={`Mensagem para ${booking.customer.name}`} placeholder="Responder"/><button className="button button-dark">Enviar</button></form> : <p className="muted">A conversa será liberada após a confirmação do pagamento.</p>}</>}
    </article>)}
  </div>{!bookings.items.length && <p className="panel muted">Nenhuma consulta nesta página.</p>}<PaginationControls page={bookings.page} total={bookings.total} pageSize={bookings.pageSize} basePath="/consultor/consultas"/></DashboardShell>;
}

// Basic data about who booked: enough to recognize the person and, if something serious happens,
// to report it. The full record stays with the platform and is handed over only to authorities.
function CustomerInfo({ info }: { info: ConsultantCustomerInfo | null }) {
  const since = (value: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(parseDbDate(value));
  return <details className="customer-info">
    <summary>Dados do cliente</summary>
    {info ? <dl>
      <div><dt>CPF</dt><dd>{info.maskedCpf} <span className="status">Identificado</span></dd></div>
      <div><dt>Idade</dt><dd>{info.age} anos</dd></div>
      <div><dt>Na Insidely desde</dt><dd>{since(info.memberSince)}</dd></div>
      <div><dt>Conversas realizadas</dt><dd>{info.pastConversations}</dd></div>
    </dl> : <p className="muted">Agendamento anterior à identificação obrigatória: este cliente ainda não registrou CPF.</p>}
    <p className="muted">Se algo grave acontecer na conversa, use &quot;Reportar problema&quot; ou o <a className="text-link" href="/suporte">suporte</a>. A Insidely guarda a identificação completa e a entrega às autoridades mediante requisição legal.</p>
  </details>;
}
