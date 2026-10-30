import { ReviewForm } from "@/components/review-form";
import { answerSurveyAction } from "@/app/actions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerDashboard } from "@/lib/queries";
import { shortDate } from "@/lib/format";
import { Role } from "@/lib/domain";
import { canReviewBooking } from "@/lib/booking-policy";

export const metadata = { title: "Avaliações" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const dashboard = await getViewerDashboard(user.id);
  // A consultant may test-book their own profile, but cannot review it (the database refuses).
  const { data: ownProfile } = await (await createSupabaseServerClient()).from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  const pending = dashboard?.customerBookings.filter((booking) => canReviewBooking(booking.status, booking.startsAt, booking.durationMinutes) && !booking.review && booking.professional.id !== ownProfile?.id) ?? [];
  const published = dashboard?.customerBookings.filter((booking) => booking.review) ?? [];
  // One-click "did it help?" for every finished conversation not answered yet.
  const finished = dashboard?.customerBookings.filter((booking) => canReviewBooking(booking.status, booking.startsAt, booking.durationMinutes) && booking.professional.id !== ownProfile?.id) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: answered } = finished.length ? await (createSupabaseServiceClient() as any).from("ConversationSurvey").select("bookingId").in("bookingId", finished.map((booking) => booking.id)) : { data: [] };
  const answeredIds = new Set((answered ?? []).map((row: { bookingId: string }) => row.bookingId));
  const survey = finished.filter((booking) => !answeredIds.has(booking.id)).slice(0, 3);
  return <DashboardShell mode="user" title="Avaliações" canConsultant={user.role === Role.CONSULTANT}>
    <div className="profile-management-stack"><section className="reviews-page-heading"><span className="eyebrow">Depois da conversa</span><h2 className="section-title">Avaliações verificadas.</h2><p className="muted reviews-page-subtitle">Assim que o horário da conversa termina, quem agendou pode dar uma nota de 0 a 5 e deixar um comentário, uma vez por encontro.</p></section>
      {survey.map((booking) => <section className="panel survey-card" key={`survey-${booking.id}`}><div><span className="eyebrow">{booking.professional.user.name} · {shortDate(booking.startsAt)}</span><strong>A conversa ajudou na sua decisão?</strong></div><div className="verification-row-actions">{([["YES", "Sim"], ["PARTLY", "Em parte"], ["NO", "Não"]] as const).map(([value, label]) => <form key={value} action={answerSurveyAction.bind(null, booking.id, value)}><button className="button button-ghost button-sm">{label}</button></form>)}</div></section>)}
      {pending.map((booking) => <ReviewForm key={booking.id} bookingId={booking.id} professionalName={booking.professional.user.name} date={shortDate(booking.startsAt)} />)}
      {!pending.length && <section className="panel"><strong>Nenhuma avaliação pendente.</strong><p className="muted">Quando o horário de uma conversa terminar, ela aparecerá aqui para você avaliar.</p></section>}
      <section className="panel"><span className="eyebrow">Suas avaliações publicadas</span><div className="list" style={{ marginTop: 18 }}>{published.map((booking) => <div className="list-row" key={booking.id}><div><strong>{booking.professional.user.name}</strong>{booking.review?.comment && <p>{booking.review.comment}</p>}</div><span className="rating">★ {booking.review?.rating}</span></div>)}{!published.length && <p className="muted">Você ainda não publicou avaliações.</p>}</div></section>
    </div>
  </DashboardShell>;
}
