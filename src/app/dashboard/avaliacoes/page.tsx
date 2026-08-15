import { Role } from "@prisma/client";
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
  return <DashboardShell mode="user" title="Avaliações"><div className="profile-management-stack"><section><span className="eyebrow">Depois da conversa</span><h2 className="section-title">Avaliações verificadas.</h2><p className="muted">Só quem participou de uma conversa concluída pode publicar uma avaliação, uma vez por encontro.</p></section>{pending.map((booking) => <ReviewForm key={booking.id} bookingId={booking.id} professionalName={booking.professional.user.name} date={shortDate(booking.startsAt)}/>)}{!pending.length && <section className="panel"><strong>Nenhuma avaliação pendente.</strong><p className="muted">Quando uma conversa for concluída, ela aparecerá aqui para você avaliar.</p></section>}<section className="panel"><span className="eyebrow">Suas avaliações publicadas</span><div className="list" style={{ marginTop: 18 }}>{published.map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.professional.user.name}</strong><p>{booking.review?.comment}</p></div><span className="rating">★ {booking.review?.rating}</span></div>)}{!published.length && <p className="muted">Você ainda não publicou avaliações.</p>}</div></section></div></DashboardShell>;
}
