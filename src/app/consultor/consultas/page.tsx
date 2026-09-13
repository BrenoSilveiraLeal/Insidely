import { cancelBookingAction, completeBookingAction, confirmConversationAction, disputeBookingAction, sendMessageAction, updateConsultantRecordingConsentAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { Role } from "@/lib/domain";
import { shortDate } from "@/lib/format";
import { getConsultantBookings, getConsultantMessages } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { canSendBookingMessage } from "@/lib/booking-policy";

export const dynamic = "force-dynamic";
function stateLabel(status: string) { return ({ PENDING_PAYMENT: "Solicitação recebida · aguardando pagamento", CONFIRMED: "Confirmada · valor retido", AWAITING_CONFIRMATION: "Aguardando confirmação", COMPLETED: "Concluída · repasse liberado", CANCELLED: "Cancelada pelo consultor", DISPUTED: "Em análise pelo suporte" } as Record<string, string>)[status] ?? status; }

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; cancelamento?: string }> }) {
  const user = await requireUser([Role.CONSULTANT]);
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const [bookings, messages] = await Promise.all([getConsultantBookings(user.id, page, 10), getConsultantMessages(user.id, 1, 100)]);
  const byConversation = new Map<string, typeof messages.items>();
  for (const message of messages.items) { const list = byConversation.get(message.conversationId) ?? []; list.push(message); byConversation.set(message.conversationId, list); }
  return <DashboardShell mode="consultant" title="Consultas e solicitações"><div className="grid grid-2">
    {query.cancelamento === "ok" && <p className="form-success" role="status">Conversa cancelada. O reembolso integral foi iniciado e o cliente foi avisado por e-mail.</p>}
    {query.cancelamento === "motivo" && <p className="form-error" role="alert">Informe um motivo com pelo menos 10 caracteres para cancelar.</p>}
    {query.cancelamento === "erro" && <p className="form-error" role="alert">Não foi possível cancelar esta conversa. Nenhuma alteração foi confirmada; tente novamente ou contate o suporte.</p>}
    {bookings.items.map(booking => <article className="panel" key={booking.id}>
      <span className="eyebrow">{stateLabel(booking.status)} · {shortDate(booking.startsAt)}</span><h2>{booking.customer.name}</h2><p>{booking.goals}</p>
      {booking.status === "PENDING_PAYMENT" && <div className="meeting-policy compact"><strong>Pedido ainda não pago</strong><p>A conversa e as mensagens serão liberadas após a confirmação do pagamento.</p></div>}
      {booking.status === "CONFIRMED" && new Date(booking.startsAt.getTime() + booking.durationMinutes * 60000) <= new Date() && <form action={completeBookingAction.bind(null, booking.id)}><button className="button button-dark button-sm">Informar fim da conversa</button></form>}
      {booking.status === "AWAITING_CONFIRMATION" && <div className="meeting-policy compact"><strong>Confirmação dupla</strong><p>{booking.consultantConfirmedAt ? "Você confirmou. Aguardando a outra pessoa ou o prazo automático." : "Confirme que a conversa aconteceu para agilizar a liberação."}</p>{!booking.consultantConfirmedAt && <form action={confirmConversationAction.bind(null, booking.id)}><button className="button button-accent button-sm">Confirmar conversa realizada</button></form>}<form className="form-stack" style={{ marginTop: 12 }} action={disputeBookingAction.bind(null, booking.id)}><textarea className="textarea" name="description" minLength={20} placeholder="Houve algum problema? Explique para o suporte."/><button className="button button-ghost button-sm">Reportar problema</button></form></div>}
      {booking.status === "DISPUTED" && <p className="form-error">O repasse está suspenso até a análise do suporte.</p>}
      {(["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && booking.startsAt > new Date()) && <form className="cancel-booking-form" action={cancelBookingAction.bind(null, booking.id)}><strong>Precisa cancelar esta conversa?</strong><p className="muted">O cliente será avisado por e-mail e, se já tiver pago, receberá o valor integral de volta.</p><textarea className="textarea" name="reason" minLength={10} maxLength={500} required placeholder="Explique brevemente o motivo do cancelamento."/><button className="button button-ghost button-sm" type="submit">Cancelar conversa</button></form>}
      <div className="meeting-policy compact"><strong>Google Meet protegido</strong><p>{booking.meetingUrl ? "A sala está disponível para esta consulta." : "A sala será criada automaticamente após a confirmação do pagamento."}</p>{booking.meetingUrl && <a className="button button-accent button-sm" href={booking.meetingUrl} target="_blank" rel="noreferrer">Abrir Google Meet</a>}</div>
      <form action={updateConsultantRecordingConsentAction.bind(null, booking.id)} className="consent-inline"><label><input name="recordingConsent" type="checkbox" defaultChecked={booking.consultantRecordingConsent}/><span>Autorizo a gravação apenas se o participante também aceitar.</span></label><button className="button button-ghost button-sm">Salvar</button></form>
      {booking.conversation && <><div className="message-thread">{(byConversation.get(booking.conversation.id) ?? []).map(message => <div key={message.id} className={`message ${message.senderId === user.id ? "message-own" : ""}`}><small>{message.sender.name}</small><br/>{message.body}</div>)}</div>{canSendBookingMessage(booking.status) ? <form action={sendMessageAction.bind(null, booking.conversation.id)} style={{ display: "flex", gap: 8 }}><input className="input" name="body" placeholder="Responder"/><button className="button button-dark">Enviar</button></form> : <p className="muted">A conversa será liberada após a confirmação do pagamento.</p>}</>}
    </article>)}
  </div>{!bookings.items.length && <p className="panel muted">Nenhuma consulta nesta página.</p>}<PaginationControls page={bookings.page} total={bookings.total} pageSize={bookings.pageSize} basePath="/consultor/consultas"/></DashboardShell>;
}
