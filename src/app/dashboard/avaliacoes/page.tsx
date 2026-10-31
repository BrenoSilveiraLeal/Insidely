import { ReviewForm } from "@/components/review-form";
import { answerSurveyAction } from "@/app/actions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/session";
import { paginate } from "@/lib/paginate";
import { PaginationControls } from "@/components/pagination-controls";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewerDashboard } from "@/lib/queries";
import { shortDate } from "@/lib/format";
import { Role } from "@/lib/domain";
import { canReviewBooking } from "@/lib/booking-policy";

export const metadata = { title: "Avaliações" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
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
  const shownReviews = paginate(published, (await searchParams).page, 20);
  return <DashboardShell mode="user" title="Avaliações" canConsultant={user.role === Role.CONSULTANT}>
    <div className="profile-management-stack"><p className="muted reviews-intro">Depois que o horário da conversa termina, você dá uma nota de 0 a 5 e, se quiser, deixa um comentário. Toda avaliação vem de uma conversa que aconteceu pela Insidely.</p>
      {survey.map((booking) => <section className="panel survey-card" key={`survey-${booking.id}`}><div><span className="eyebrow">{booking.professional.user.name} · {shortDate(booking.startsAt)}</span><strong>A conversa ajudou na sua decisão?</strong></div><div className="verification-row-actions">{([["YES", "Sim"], ["PARTLY", "Em parte"], ["NO", "Não"]] as const).map(([value, label]) => <form key={value} action={answerSurveyAction.bind(null, booking.id, value)}><button className="button button-ghost button-sm">{label}</button></form>)}</div></section>)}
      {pending.length > 0 && <h2 className="reviews-list-title">Para avaliar</h2>}
      {pending.map((booking) => <ReviewForm key={booking.id} bookingId={booking.id} professionalName={booking.professional.user.name} date={shortDate(booking.startsAt)} />)}
      
      {published.length > 0 && <section className="panel"><h2 className="reviews-list-title">Suas avaliações</h2><div className="list reviews-mine">{shownReviews.items.map((booking) => <div className="list-row review-mine" key={booking.id}>
        <div><strong>{booking.professional.user.name}</strong><span className="muted review-mine-date">Conversa de {shortDate(booking.startsAt).split(" às ")[0]}</span>{booking.review?.comment && <p>{booking.review.comment}</p>}
          <div className="review-mine-tags"><span className="review-tag">Conversa realizada</span>{booking.professional.verificationStatus === "VERIFIED" && <span className="review-tag is-verified">Vínculo verificado</span>}</div></div>
        <span className="rating">★ {booking.review?.rating}</span>
      </div>)}</div><PaginationControls page={shownReviews.page} total={shownReviews.total} pageSize={shownReviews.pageSize} basePath="/dashboard/avaliacoes"/></section>}
      {!pending.length && !published.length && <section className="panel empty-state"><h2>Nenhuma avaliação ainda</h2><p className="muted">Quando o horário de uma conversa terminar, ela aparece aqui para você avaliar.</p></section>}
    </div>
  </DashboardShell>;
}
