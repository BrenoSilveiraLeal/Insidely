import { BookingStatus, PaymentStatus, Role } from "@/lib/domain";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { money, shortDate } from "@/lib/format";
import { getConsultantDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConsultantDashboard() {
  const user = await requireUser([Role.CONSULTANT]);
  const profile = await getConsultantDashboard(user.id);
  if (!profile) return <DashboardShell mode="consultant" title="Complete seu perfil"><p className="panel">Seu perfil profissional ainda não existe. Conclua o onboarding.</p></DashboardShell>;
  const revenue = profile.bookings.filter((booking) => booking.payment?.status === PaymentStatus.RELEASED).reduce((sum, booking) => sum + (booking.payment?.amountCents ?? 0) - booking.feeCents, 0);
  const held = profile.bookings.filter((booking) => booking.payment?.status === PaymentStatus.HELD).reduce((sum, booking) => sum + (booking.payment?.amountCents ?? 0) - booking.feeCents, 0);
  const upcoming = profile.bookings.filter((booking) => booking.status === BookingStatus.CONFIRMED && booking.startsAt > new Date());
  const requests = profile.bookings.filter((booking) => booking.status === BookingStatus.PENDING_PAYMENT || booking.payment?.status === "PAYMENT_REPORTED");
  const unreadNotifications = profile.notifications.filter((notification) => !notification.readAt);
  return <DashboardShell mode="consultant" title={`Olá, ${profile.user.name.split(" ")[0]}.`} notificationCount={unreadNotifications.length}><div className="grid grid-4"><div className="metric"><span>Visualizações</span><strong>{profile.profileViews.length}</strong></div><div className="metric"><span>Favoritos</span><strong>{profile.favorites.length}</strong></div><div className="metric"><span>Conversas</span><strong>{profile.bookings.length}</strong></div><div className="metric"><span>Repasse liberado</span><strong>{money(revenue)}</strong><small className="muted">Retido: {money(held)}</small></div></div>
    {profile.notifications.length > 0 && <section className="section notification-panel" id="notificacoes" style={{ paddingBottom: 0 }}><div className="section-head"><div><span className="eyebrow">Atualizações</span><h2>O que mudou por aqui.</h2></div>{unreadNotifications.length > 0 && <form action={markAllNotificationsReadAction}><button className="button button-ghost button-sm">Marcar todas como lidas</button></form>}</div><div className="list">{profile.notifications.slice(0, 10).map((notification) => <div className={`list-row ${notification.readAt ? "" : "notification-unread"}`} key={notification.id}><div><strong>{notification.title}</strong><p className="muted">{notification.body}</p></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}>{notification.href && <a className="button button-ghost button-sm" href={notification.href}>Abrir</a>}{!notification.readAt && <form action={markNotificationReadAction.bind(null, notification.id)}><button className="button button-ghost button-sm">Lida</button></form>}</div></div>)}</div></section>}
    <section className="section" style={{ paddingBottom: 0 }}><div className="section-head"><div><span className="eyebrow">Solicitações recebidas</span><h2>{requests.length ? `${requests.length} pedido${requests.length === 1 ? "" : "s"} aguardando atenção` : "Nenhuma solicitação nova"}</h2></div><a className="button button-ghost button-sm" href="/consultor/consultas">Ver consultas</a></div><div className="list" style={{ marginTop: 20 }}>{requests.slice(0, 5).map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.customer.name}</strong><p>{shortDate(booking.startsAt)} · {booking.durationMinutes} min · {booking.payment?.status === "PAYMENT_REPORTED" ? "Pagamento informado" : "Aguardando pagamento"}</p></div><span className="status">NOVA</span></div>)}{!requests.length && <p className="muted">Quando alguém escolher um horário do seu perfil, o pedido aparecerá aqui.</p>}</div></section>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Próximas consultas</span><div className="list" style={{ marginTop: 20 }}>{upcoming.map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.customer.name}</strong><p>{shortDate(booking.startsAt)} · {booking.topics.join(", ")}</p></div><span className="status">VALOR RETIDO</span></div>)}</div></section></DashboardShell>;
}
