import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfessionalCard } from "@/components/cards";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const dashboard = await getViewerDashboard(user.id);
  const history = Array.from(new Map((dashboard?.customerBookings ?? []).sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()).map((booking) => [booking.professional.id, booking.professional])).values());
  return <DashboardShell mode="user" title="Favoritos" canConsultant={user.role === Role.CONSULTANT}>
    <section><div className="section-head"><div><span className="eyebrow">Seus perfis</span><h2>Perfis salvos</h2></div></div><div className="grid grid-3">{dashboard?.favorites.map((favorite, index) => <ProfessionalCard key={favorite.id} profile={favorite.professionalProfile} index={index} />)}</div>{!dashboard?.favorites.length && <div className="panel">Você ainda não salvou nenhum perfil.</div>}</section>
    <section className="section compact-section"><div className="section-head"><div><span className="eyebrow">Seu histórico</span><h2>Perfis conversados recentemente</h2></div></div><div className="grid grid-3">{history.map((profile, index) => <ProfessionalCard key={profile.id} profile={profile} index={index} />)}</div>{!history.length && <div className="panel">Seus perfis conversados aparecerão aqui.</div>}</section>
  </DashboardShell>;
}
