import Link from "next/link";
import { confirmConversationAction, disputeBookingAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { BookingStatus, Role } from "@/lib/domain";
import { bookingStatusLabel, meetingRoomOpeningText, money, shortDate } from "@/lib/format";
import { isMeetingRoomOpen, meetingRoomState, paymentDeadline } from "@/lib/booking-policy";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const dashboard = await getViewerDashboard(user.id);
  return <DashboardShell mode="user" title="Agendamentos"><div className="grid grid-2">{dashboard?.customerBookings.map((booking) => <article className="panel" key={booking.id}>
    <span className="eyebrow">{bookingStatusLabel(booking.status)} · {shortDate(booking.startsAt)}</span><h2>{booking.professional.user.name}</h2><p className="muted">{booking.durationMinutes} min · {money(booking.totalCents)} · Sala online</p>
    {booking.status === BookingStatus.PENDING_PAYMENT && <><p className="muted">Conclua o pagamento até {shortDate(paymentDeadline(booking.createdAt, booking.startsAt, booking.durationMinutes))}. Depois disso, o horário é liberado automaticamente.</p><Link className="button button-accent button-sm" href={`/checkout/${booking.id}`}>Concluir pagamento</Link></>}
    {booking.status === BookingStatus.EXPIRED && <p className="muted">O pagamento não foi concluído a tempo. O horário foi liberado e este registro permanece no histórico.</p>}
    {booking.status === BookingStatus.CONFIRMED && booking.startsAt <= new Date() && <div className="meeting-policy compact"><span>◉</span><div><strong>A conversa terminou?</strong><p>Confirme quando a conversa acabar para concluir o encontro e liberar a avaliação.</p><form action={confirmConversationAction.bind(null, booking.id)}><button className="button button-accent button-sm">Confirmar conversa realizada</button></form></div></div>}
    {booking.status === BookingStatus.CONFIRMED && <div className="meeting-policy compact"><span>↗</span><div><strong>Sala protegida</strong><p>{meetingRoomState(booking.startsAt, booking.durationMinutes) === "upcoming" ? meetingRoomOpeningText(booking.startsAt) : meetingRoomState(booking.startsAt, booking.durationMinutes) === "ended" ? "O horário de entrada da sala já terminou." : booking.meetingUrl ? "A sala da conversa está disponível." : "A sala da conversa está sendo preparada."}</p><div className="about-actions"><a className="button button-ghost button-sm" href={`/api/calendar/${booking.id}`}>Adicionar ao calendário</a>{booking.meetingUrl && isMeetingRoomOpen(booking.startsAt, booking.durationMinutes) && <Link className="button button-accent button-sm" href={`/consulta/${booking.id}`}>Entrar na videochamada</Link>}</div></div></div>}
    {booking.status === "AWAITING_CONFIRMATION" && <div className="meeting-policy compact"><span>◉</span><div><strong>Você realizou a conversa?</strong><p>{booking.customerConfirmedAt ? "Você confirmou. Aguardando a outra pessoa ou o prazo automático de 24 horas." : "Confirme para liberar o repasse ao consultor. Se houve um problema, abra uma contestação."}</p>{!booking.customerConfirmedAt && <form action={confirmConversationAction.bind(null, booking.id)}><button className="button button-accent button-sm">Confirmar conversa realizada</button></form>}<form className="form-stack" style={{ marginTop: 12 }} action={disputeBookingAction.bind(null, booking.id)}><textarea className="textarea" name="description" minLength={20} placeholder="Descreva o problema para o suporte"/><button className="button button-ghost button-sm">Reportar problema</button></form></div></div>}
    {booking.status === "DISPUTED" && <p className="form-error">A contestação foi registrada. O valor continua retido até o suporte analisar.</p>}
    <p className="muted">Registros de presença e duração ajudam o suporte. A gravação exige aceite específico dos dois participantes.</p>
  </article>)}</div>{!dashboard?.customerBookings.length && <section className="panel"><h2>Nenhum agendamento ainda</h2><p className="muted">Encontre um profissional e escolha um horário para começar.</p><Link className="button button-dark" href="/buscar">Encontrar profissional</Link></section>}</DashboardShell>;
}
