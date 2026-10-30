import { BookingStatus, PaymentStatus, Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import Link from "next/link";
import { bookingCountdown, dateTimeInBrazil, money, shortDate } from "@/lib/format";
import { meetingRoomState } from "@/lib/booking-policy";
import { getConsultantDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { WelcomeTour } from "@/components/welcome-tour";
import { getConsultantPerformance } from "@/lib/consultant-insights";

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
  const performance = await getConsultantPerformance(profile.id);
  const notifications = profile.notifications.map(({ id, title, body, href, readAt }) => ({ id, title, body, href, readAt: readAt?.toISOString() ?? null }));

  const next = [...upcoming].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  const later = upcoming.filter((booking) => booking !== next).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return <DashboardShell mode="consultant" title={`Olá, ${profile.user.name.split(" ")[0]}.`} notifications={notifications}><WelcomeTour kind="consultant"/>
    <div className="consultant-home">
      {next ? <section className="panel next-conversation">
        <div><span className="eyebrow">Próxima conversa · {bookingCountdown(next.startsAt)}</span><h2>{next.customer.name}</h2><p className="muted">{dateTimeInBrazil(next.startsAt)} · {next.durationMinutes} min</p>{next.goals && <p className="next-conversation-goal">“{next.goals.length > 180 ? `${next.goals.slice(0, 180)}…` : next.goals}”</p>}</div>
        <div className="next-conversation-actions"><Link className="button button-dark" href={`/conversa/${next.id}`}>Abrir conversa</Link><Link className="button button-ghost" href="/consultor/consultas">Todas as consultas</Link></div>
      </section> : <section className="panel next-conversation is-empty">
        <div><span className="eyebrow">Próxima conversa</span><h2>Nenhuma conversa marcada</h2><p className="muted">Abra horários na agenda para aparecer com disponibilidade na busca.</p></div>
        <div className="next-conversation-actions"><Link className="button button-dark" href="/consultor/agenda">Abrir horários</Link></div>
      </section>}

      <section><div className="consultant-home-head"><span className="eyebrow">Últimos 30 dias</span><a className="text-link" href="/api/ganhos">Baixar planilha de ganhos</a></div>
        <div className="grid grid-4 consultant-metrics">
          <div className="metric"><span>Visitas ao perfil</span><strong>{performance.views}</strong><small className="muted">{profile.profileViews.length} no total</small></div>
          <div className="metric"><span>Conversas agendadas</span><strong>{performance.booked}</strong><small className="muted">{profile.favorites.length} {profile.favorites.length === 1 ? "pessoa salvou" : "pessoas salvaram"} seu perfil</small></div>
          <div className="metric"><span>Conversão</span><strong>{performance.conversion === null ? "—" : `${String(performance.conversion).replace(".", ",")}%`}</strong><small className="muted">visitas que viraram conversa</small></div>
          <div className="metric"><span>Nota média</span><strong>{performance.rating === null ? "—" : `★ ${performance.rating.toFixed(1)}`}</strong><small className="muted">{performance.rating === null ? "ainda sem avaliações" : "nas avaliações recebidas"}</small></div>
        </div>
      </section>

      <div className="consultant-home-columns">
        <section className="panel consultant-home-card">
          <div className="consultant-home-head"><span className="eyebrow">Agenda</span><Link className="text-link" href="/consultor/consultas">Ver tudo</Link></div>
          {requests.length > 0 && <div className="consultant-home-group"><strong>Aguardando pagamento</strong>{requests.slice(0, 3).map((booking) => <Link className="consultant-home-row" href="/consultor/consultas" key={booking.id}><span>{booking.customer.name}</span><small className="muted">{shortDate(booking.startsAt)} · {booking.payment?.status === "PAYMENT_REPORTED" ? "pagamento informado" : "aguardando"}</small></Link>)}</div>}
          <div className="consultant-home-group"><strong>Depois da próxima</strong>{later.slice(0, 4).map((booking) => <Link className="consultant-home-row" href={`/conversa/${booking.id}`} key={booking.id}><span>{booking.customer.name}</span><small className="muted">{shortDate(booking.startsAt)} · {booking.durationMinutes} min</small></Link>)}{!later.length && <p className="muted">Nenhuma outra conversa marcada.</p>}</div>
        </section>
        <section className="panel consultant-home-card">
          <div className="consultant-home-head"><span className="eyebrow">Ganhos</span><Link className="text-link" href="/consultor/ganhos">Detalhes</Link></div>
          <div className="earnings-split">
            <div><span className="muted">Liberado</span><strong>{money(revenue)}</strong></div>
            <div><span className="muted">Retido até a conversa</span><strong>{money(held)}</strong></div>
          </div>
          <p className="muted">Nos últimos 30 dias, {money(performance.earnings)} em conversas agendadas. O valor retido é liberado depois que a conversa acontece.</p>
        </section>
      </div>
    </div>
  </DashboardShell>;
}
