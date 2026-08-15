import { BookingStatus, PaymentStatus, Role } from "@/lib/domain";
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
  return <DashboardShell mode="consultant" title={`Olá, ${profile.user.name.split(" ")[0]}.`}><div className="grid grid-4"><div className="metric"><span>Visualizações</span><strong>{profile.profileViews.length}</strong></div><div className="metric"><span>Favoritos</span><strong>{profile.favorites.length}</strong></div><div className="metric"><span>Conversas</span><strong>{profile.bookings.length}</strong></div><div className="metric"><span>Repasse liberado</span><strong>{money(revenue)}</strong><small className="muted">Retido: {money(held)}</small></div></div><section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Próximas consultas</span><div className="list" style={{ marginTop: 20 }}>{upcoming.map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.customer.name}</strong><p>{shortDate(booking.startsAt)} · {booking.topics.join(", ")}</p></div><span className="status">VALOR RETIDO</span></div>)}</div></section></DashboardShell>;
}
