import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedUser } from "@/lib/session";
import { getConsultantDashboard, getViewerDashboard } from "@/lib/queries";
import { Role } from "@/lib/domain";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/entrar");
  const { id } = await params;
  let booking;
  let otherPerson = "seu consultor";
  if (user.role === Role.CONSULTANT) {
    booking = (await getConsultantDashboard(user.id))?.bookings.find((item) => item.id === id);
    otherPerson = booking?.customer.name ?? "seu cliente";
  } else {
    booking = (await getViewerDashboard(user.id))?.customerBookings.find((item) => item.id === id);
    otherPerson = booking?.professional.user.name ?? "seu consultor";
  }

  if (!booking || booking.status !== "CONFIRMED" || !booking.meetingUrl) notFound();
  return <DashboardShell mode={user.role === Role.CONSULTANT ? "consultant" : "user"} title="Sua consulta">
    <div className="profile-layout">
      <section className="panel">
        <span className="eyebrow">Consulta confirmada</span>
        <h2>Você está prestes a conversar com {otherPerson}.</h2>
        <p className="muted">{shortDate(booking.startsAt)} · {booking.durationMinutes} minutos</p>
        <div className="meeting-policy">
          <strong>Sala protegida pela Insidely</strong>
          <p>O link só aparece depois da confirmação do pagamento. Abra a sala no horário combinado para iniciar a conversa.</p>
        </div>
        <a className="button button-accent" href={booking.meetingUrl} target="_blank" rel="noreferrer">Entrar no Google Meet</a>
        <Link className="button button-ghost" href={user.role === Role.CONSULTANT ? "/consultor/consultas" : "/dashboard/agendamentos"}>Voltar para consultas</Link>
      </section>
      <aside className="booking-box">
        <span className="eyebrow">Contexto combinado</span>
        <h3>{booking.goals}</h3>
        <p className="muted">A Insidely permanece disponível para registrar a conclusão e a avaliação após a conversa.</p>
      </aside>
    </div>
  </DashboardShell>;
}
