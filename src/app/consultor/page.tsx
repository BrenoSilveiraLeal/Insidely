import { BookingStatus, PaymentStatus, Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import Link from "next/link";
import { money, shortDate } from "@/lib/format";
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
  // Open chats (paid, not closed yet), oldest first: the one waiting longest comes first.
  const upcoming = profile.bookings.filter((booking) => booking.status === BookingStatus.CONFIRMED && booking.format === "MESSAGE");
  const requests = profile.bookings.filter((booking) => booking.status === BookingStatus.PENDING_PAYMENT || booking.payment?.status === "PAYMENT_REPORTED");
  const performance = await getConsultantPerformance(profile.id);

  const next = [...upcoming].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  const later = upcoming.filter((booking) => booking !== next).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return <DashboardShell mode="consultant" title={`Olá, ${profile.user.name.split(" ")[0]}.`}><WelcomeTour kind="consultant"/>
    <div className="consultant-home">
      {!profile.pixKey?.trim() && <section className="panel pix-missing"><div><strong>Falta a sua chave Pix</strong><p className="muted">É para onde vai o valor das suas conversas. Cadastre em Editar perfil.</p></div><Link className="button button-dark button-sm" href="/consultor/perfil">Cadastrar chave Pix</Link></section>}
      {next ? <section className="panel next-conversation">
        <div><span className="eyebrow">Chat aberto{upcoming.length > 1 ? ` · ${upcoming.length} no total` : ""}</span><h2>{next.customer.name}</h2><p className="muted">Aberto em {shortDate(next.startsAt)}</p>{next.goals && <p className="next-conversation-goal">“{next.goals.length > 180 ? `${next.goals.slice(0, 180)}…` : next.goals}”</p>}</div>
        <div className="next-conversation-actions"><Link className="button button-dark" href={`/conversa/${next.id}`}>Abrir chat</Link><Link className="button button-ghost" href="/consultor/consultas">Todos os chats</Link></div>
      </section> : <section className="panel next-conversation is-empty">
        <div><span className="eyebrow">Chats</span><h2>Nenhum chat aberto</h2><p className="muted">Quando alguém abrir um chat com você, ele aparece aqui. Informe em Horários quando você costuma responder.</p></div>
        <div className="next-conversation-actions"><Link className="button button-dark" href="/consultor/agenda">Meus horários</Link></div>
      </section>}

      <section><div className="consultant-home-head"><span className="eyebrow">Últimos 30 dias</span><a className="text-link" href="/api/ganhos">Baixar planilha de ganhos</a></div>
        <div className="grid grid-4 consultant-metrics">
          <div className="metric"><span>Visitas ao perfil</span><strong>{performance.views}</strong><small className="muted">{profile.profileViews.length} no total</small></div>
          <div className="metric"><span>Chats abertos</span><strong>{performance.booked}</strong><small className="muted">{profile.favorites.length} {profile.favorites.length === 1 ? "pessoa salvou" : "pessoas salvaram"} seu perfil</small></div>
          <div className="metric"><span>Conversão</span><strong>{performance.conversion === null ? "—" : `${String(performance.conversion).replace(".", ",")}%`}</strong><small className="muted">visitas que viraram conversa</small></div>
          <div className="metric"><span>Nota média</span><strong>{performance.rating === null ? "—" : `★ ${performance.rating.toFixed(1)}`}</strong><small className="muted">{performance.rating === null ? "ainda sem avaliações" : "nas avaliações recebidas"}</small></div>
        </div>
      </section>

      <div className="consultant-home-columns">
        <section className="panel consultant-home-card">
          <div className="consultant-home-head"><span className="eyebrow">Chats</span><Link className="text-link" href="/consultor/consultas">Ver tudo</Link></div>
          {requests.length > 0 && <div className="consultant-home-group"><strong>Aguardando pagamento</strong>{requests.slice(0, 3).map((booking) => <Link className="consultant-home-row" href="/consultor/consultas" key={booking.id}><span>{booking.customer.name}</span><small className="muted">{shortDate(booking.startsAt)} · {booking.payment?.status === "PAYMENT_REPORTED" ? "pagamento informado" : "aguardando"}</small></Link>)}</div>}
          <div className="consultant-home-group"><strong>Outros chats abertos</strong>{later.slice(0, 4).map((booking) => <Link className="consultant-home-row" href={`/conversa/${booking.id}`} key={booking.id}><span>{booking.customer.name}</span><small className="muted">aberto em {shortDate(booking.startsAt)}</small></Link>)}{!later.length && <p className="muted">Nenhum outro chat aberto.</p>}</div>
        </section>
        <section className="panel consultant-home-card">
          <div className="consultant-home-head"><span className="eyebrow">Ganhos</span><Link className="text-link" href="/consultor/ganhos">Detalhes</Link></div>
          <div className="earnings-split">
            <div><span className="muted">Liberado</span><strong>{money(revenue)}</strong></div>
            <div><span className="muted">Retido até o chat fechar</span><strong>{money(held)}</strong></div>
          </div>
          <p className="muted">Nos últimos 30 dias, {money(performance.earnings)} em chats. O valor retido é liberado quando o cliente confirma ou 24 horas depois que o chat fecha, sem contestação.</p>
        </section>
      </div>
    </div>
  </DashboardShell>;
}
