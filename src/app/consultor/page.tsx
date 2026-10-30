import { BookingStatus, PaymentStatus, Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { money, shortDate } from "@/lib/format";
import { meetingRoomState } from "@/lib/booking-policy";
import { getConsultantDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { WelcomeTour } from "@/components/welcome-tour";
import { getConsultantPerformance, getProfileCompleteness } from "@/lib/consultant-insights";

export const metadata = { title: "Painel do consultor" };
export const dynamic = "force-dynamic";

export default async function ConsultantDashboard() {
  const user = await requireUser([Role.CONSULTANT]);
  const profile = await getConsultantDashboard(user.id);
  if (!profile) return <DashboardShell mode="consultant" title="Complete seu perfil"><p className="panel">Seu perfil profissional ainda não existe. Conclua o onboarding.</p></DashboardShell>;
  const revenue = profile.bookings.filter((booking) => booking.payment?.status === PaymentStatus.RELEASED).reduce((sum, booking) => sum + (booking.payment?.amountCents ?? 0) - booking.feeCents, 0);
  const held = profile.bookings.filter((booking) => [PaymentStatus.HELD, PaymentStatus.PAID_HELD].includes(booking.payment?.status as PaymentStatus)).reduce((sum, booking) => sum + (booking.payment?.amountCents ?? 0) - booking.feeCents, 0);
  const upcoming = profile.bookings.filter((booking) => booking.status === BookingStatus.CONFIRMED && meetingRoomState(booking.startsAt, booking.durationMinutes) !== "ended");
  const requests = profile.bookings.filter((booking) => booking.status === BookingStatus.PENDING_PAYMENT || booking.payment?.status === "PAYMENT_REPORTED");
  const [completeness, performance] = await Promise.all([getProfileCompleteness(user.id), getConsultantPerformance(profile.id)]);
  const notifications = profile.notifications.map(({ id, title, body, href, readAt }) => ({ id, title, body, href, readAt: readAt?.toISOString() ?? null }));

  return <DashboardShell mode="consultant" title={`Olá, ${profile.user.name.split(" ")[0]}.`} notifications={notifications}><WelcomeTour kind="consultant"/>
    <div className="grid grid-4"><div className="metric"><span>Visualizações</span><strong>{profile.profileViews.length}</strong></div><div className="metric"><span>Favoritos</span><strong>{profile.favorites.length}</strong></div><div className="metric"><span>Conversas</span><strong>{profile.bookings.length}</strong></div><div className="metric"><span>Repasse liberado</span><strong>{money(revenue)}</strong><small className="muted">Retido: {money(held)}</small></div></div>
    {completeness.percent < 100 && <section className="panel completeness"><div className="completeness-head"><div><span className="eyebrow">Perfil completo</span><h2>{completeness.percent}% pronto</h2></div><div className="completeness-bar" role="progressbar" aria-valuenow={completeness.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${completeness.percent}%` }}/></div></div><p className="muted">Perfis completos aparecem com mais confiança na busca e recebem mais agendamentos. Falta:</p><ul className="completeness-list">{completeness.items.filter((item) => !item.done).map((item) => <li key={item.label}><a className="text-link" href={item.href}>{item.label}</a></li>)}</ul></section>}
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Desempenho · últimos 30 dias</span><div className="grid grid-4" style={{ marginTop: 14 }}><div className="metric"><span>Visitas ao perfil</span><strong>{performance.views}</strong></div><div className="metric"><span>Conversas agendadas</span><strong>{performance.booked}</strong></div><div className="metric"><span>Conversão</span><strong>{performance.conversion === null ? "—" : `${String(performance.conversion).replace(".", ",")}%`}</strong></div><div className="metric"><span>Nota média</span><strong>{performance.rating === null ? "—" : `★ ${performance.rating.toFixed(1)}`}</strong></div></div><p className="muted" style={{ marginTop: 10 }}>Você recebeu {money(performance.earnings)} em conversas agendadas nos últimos 30 dias. <a className="text-link" href="/api/ganhos">Baixar planilha de ganhos</a></p></section>
    <section className="section" style={{ paddingBottom: 0 }}><div className="section-head"><div><span className="eyebrow">Solicitações recebidas</span><h2>{requests.length ? `${requests.length} pedido${requests.length === 1 ? "" : "s"} aguardando atenção` : "Nenhuma solicitação nova"}</h2></div><a className="button button-ghost button-sm" href="/consultor/consultas">Ver consultas</a></div><div className="list" style={{ marginTop: 20 }}>{requests.slice(0, 5).map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.customer.name}</strong><p>{shortDate(booking.startsAt)} · {booking.durationMinutes} min · {booking.payment?.status === "PAYMENT_REPORTED" ? "Pagamento informado" : "Aguardando pagamento"}</p></div><span className="status">NOVA</span></div>)}{!requests.length && <p className="muted">Quando alguém escolher um horário do seu perfil, o pedido aparecerá aqui.</p>}</div></section>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Próximas consultas</span><div className="list" style={{ marginTop: 20 }}>{!upcoming.length && <p className="muted">Nenhuma consulta agendada.</p>}{upcoming.map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.customer.name}</strong><p>{shortDate(booking.startsAt)} · {booking.topics.join(", ")}</p></div><span className="status">VALOR RETIDO</span></div>)}</div></section>
  </DashboardShell>;
}
