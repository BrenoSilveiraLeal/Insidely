import { Role } from "@/lib/domain";
import { sendMessageAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { RealtimeMessageThread } from "@/components/realtime-message-thread";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { canSendBookingMessage } from "@/lib/booking-policy";

export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const dashboard = await getViewerDashboard(user.id);
  const threads = dashboard?.customerBookings.filter((booking) => booking.conversation) ?? [];
  return <DashboardShell mode="user" title="Mensagens" canConsultant={user.role === Role.CONSULTANT}>
    <div className="grid grid-2">{threads.map((booking) => <article className="panel" key={booking.id}>
      <span className="eyebrow">{booking.professional.user.name}</span>
      <RealtimeMessageThread conversationId={booking.conversation!.id} currentUserId={user.id} initialMessages={booking.conversation!.messages.map((message) => ({ id: message.id, body: message.body, senderId: message.senderId }))}/>
      {canSendBookingMessage(booking.status) ? <form action={sendMessageAction.bind(null, booking.conversation!.id)} style={{ display: "flex", gap: 8 }}><input className="input" name="body" aria-label="Mensagem" placeholder="Escreva uma mensagem"/><button className="button button-dark">Enviar</button></form> : <p className="muted">O pedido foi recebido. A conversa será liberada após a confirmação do pagamento.</p>}
    </article>)}</div>
    {!threads.length && <section className="panel"><h2>Nenhuma conversa ainda</h2><p className="muted">Quando um agendamento for confirmado, as mensagens aparecerão aqui.</p></section>}
  </DashboardShell>;
}
