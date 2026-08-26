import Link from "next/link";
import { Role } from "@/lib/domain";
import { sendMessageAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { RealtimeMessageThread } from "@/components/realtime-message-thread";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { canSendBookingMessage } from "@/lib/booking-policy";
import { money, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function requestStatus(status: string) {
  return ({ PENDING_PAYMENT: "Pedido aguardando pagamento", CONFIRMED: "Agendamento confirmado", AWAITING_CONFIRMATION: "Conversa realizada", COMPLETED: "Conversa concluída", DISPUTED: "Pedido em análise" } as Record<string, string>)[status] ?? "Pedido de agendamento";
}

export default async function Page() {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const dashboard = await getViewerDashboard(user.id);
  const requests = dashboard?.customerBookings ?? [];

  return <DashboardShell mode="user" title="Mensagens" canConsultant={user.role === Role.CONSULTANT}>
    <div className="section-head"><div><span className="eyebrow">Acompanhe seus pedidos</span><h2>Agendamentos e conversas</h2><p className="muted">Todo pedido de agendamento aparece aqui. A conversa é liberada depois que o pagamento for confirmado.</p></div><Link className="button button-dark" href="/dashboard/agendamentos">Ver agenda</Link></div>
    <div className="grid grid-2">{requests.map((booking) => <article className="panel message-request-card" key={booking.id}>
      <div className="message-request-heading"><div><span className="eyebrow">{requestStatus(booking.status)}</span><h2>{booking.professional.user.name}</h2></div><span className="status">{shortDate(booking.startsAt)}</span></div>
      <p className="muted">{booking.durationMinutes} min · {money(booking.totalCents)} · pedido de agendamento</p>
      <div className="meeting-policy compact"><span>◷</span><div><strong>{booking.status === "PENDING_PAYMENT" ? "Finalize o pedido" : booking.conversation ? "Conversa protegida" : "Pedido recebido"}</strong><p>{booking.status === "PENDING_PAYMENT" ? "O horário fica reservado enquanto você conclui o pagamento." : booking.conversation ? "Use este espaço para alinhar os últimos detalhes." : "Assim que este pedido avançar, as mensagens aparecerão aqui."}</p></div></div>
      {booking.conversation && <RealtimeMessageThread conversationId={booking.conversation.id} currentUserId={user.id} initialMessages={booking.conversation.messages.map((message) => ({ id: message.id, body: message.body, senderId: message.senderId }))}/>}
      {booking.status === "PENDING_PAYMENT" ? <Link className="button button-accent button-block" href={`/checkout/${booking.id}`}>Continuar pagamento</Link> : booking.conversation && canSendBookingMessage(booking.status) ? <form action={sendMessageAction.bind(null, booking.conversation.id)} style={{ display: "flex", gap: 8 }}><input className="input" name="body" aria-label={`Mensagem para ${booking.professional.user.name}`} placeholder="Escreva uma mensagem"/><button className="button button-dark">Enviar</button></form> : <p className="muted">O pedido está aguardando a próxima etapa.</p>}
    </article>)}</div>
    {!requests.length && <section className="panel"><h2>Nenhum pedido de agendamento</h2><p className="muted">Quando você escolher um horário, o pedido e a conversa aparecerão aqui.</p><Link className="button button-dark" href="/buscar">Encontrar profissional</Link></section>}
  </DashboardShell>;
}
