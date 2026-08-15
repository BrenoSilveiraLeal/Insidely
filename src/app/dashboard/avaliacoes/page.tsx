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
  return <DashboardShell mode="user" title="Avalia??es"><div className="profile-management-stack"><section><span className="eyebrow">Depois da conversa</span><h2 className="section-title">Avalia??es verificadas.</h2><p className="muted">S? quem participou de uma conversa conclu pode publicar uma avalia, uma vez por encontro.</p></section>{pending.map((booking) => <ReviewForm key={booking.id} bookingId={booking.id} professionalName={booking.professional.user.name} date={shortDate(booking.startsAt)}/>)}{!pending.length && <section className="panel"><strong>Nenhuma avalia pendente.</strong><p className="muted">Quando uma conversa for conclu, ela aparecer? aqui para voc avaliar.</p></section>}<section className="panel"><span className="eyebrow">Suas avalia publicadas</span><div className="list" style={{ marginTop: 18 }}>{published.map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.professional.user.name}</strong><p>{booking.review?.comment}</p></div><span className="rating">?~. {booking.review?.rating}</span></div>)}{!published.length && <p className="muted">Voc n publicou avalia.</p>}</div></section></div></DashboardShell>;
}
