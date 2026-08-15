import { Role } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { getViewerDashboard } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const user = await requireUser([Role.USER, Role.ADMIN]);
  const dashboard = await getViewerDashboard(user.id);
  return <DashboardShell mode="user" title="Agendamentos"><div className="grid grid-2">{dashboard?.customerBookings.map((booking) => <article className="panel" key={booking.id}><span className="eyebrow">{booking.status} · {shortDate(booking.startsAt)}</span><h2>{booking.professional.user.name}</h2><p className="muted">{booking.durationMinutes} min · {money(booking.totalCents)} · Google Meet</p><div className="meeting-policy compact"><span>◉</span><div><strong>Sala protegida</strong><p>{booking.meetingUrl ? "A sala está disponível." : "O link aparece aqui 15 minutos antes do horário."}</p></div></div><p className="muted">Presença e duração registradas para suporte. Gravação exige aceite dos dois participantes.</p></article>)}</div></DashboardShell>;
}
