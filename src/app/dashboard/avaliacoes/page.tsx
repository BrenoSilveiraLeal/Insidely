import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { ReviewForm } from "@/components/review-form";
import { shortDate } from "@/lib/format";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser([Role.USER, Role.ADMIN]); const dashboard = await getViewerDashboard(user.id);
  const pending = dashboard?.customerBookings.filter((booking) => booking.status === "COMPLETED" && !booking.review) ?? [];
  const published = dashboard?.customerBookings.filter((booking) => booking.review) ?? [];
  return <DashboardShell mode="user" title="AvaliaÃ§Ãµes"><div className="profile-management-stack"><section><span className="eyebrow">Depois da conversa</span><h2 className="section-title">AvaliaÃ§Ãµes verificadas.</h2><p className="muted">SÃ³ quem participou de uma conversa concluÃ­da pode publicar uma avaliaÃ§Ã£o, uma vez por encontro.</p></section>{pending.map((booking) => <ReviewForm key={booking.id} bookingId={booking.id} professionalName={booking.professional.user.name} date={shortDate(booking.startsAt)}/>)}{!pending.length && <section className="panel"><strong>Nenhuma avaliaÃ§Ã£o pendente.</strong><p className="muted">Quando uma conversa for concluÃ­da, ela aparecerÃ¡ aqui para vocÃª avaliar.</p></section>}<section className="panel"><span className="eyebrow">Suas avaliaÃ§Ãµes publicadas</span><div className="list" style={{ marginTop: 18 }}>{published.map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.professional.user.name}</strong><p>{booking.review?.comment}</p></div><span className="rating">â˜… {booking.review?.rating}</span></div>)}{!published.length && <p className="muted">VocÃª ainda nÃ£o publicou avaliaÃ§Ãµes.</p>}</div></section></div></DashboardShell>;
}
