import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAuthenticatedUser } from "@/lib/session";
import { getBookingForParticipant } from "@/lib/queries";
import { Role } from "@/lib/domain";
import { meetingRoomOpeningText, shortDate } from "@/lib/format";
import { canReviewBooking, meetingRoomState } from "@/lib/booking-policy";

export const metadata = { title: "Sua consulta" };
export const dynamic = "force-dynamic";

export default async function ConsultationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/entrar");
  const { id } = await params;
  const booking = await getBookingForParticipant(id,user.id,user.role);
  let otherPerson = "seu consultor";
  if (user.role === Role.CONSULTANT) {
    otherPerson = booking?.customer.name ?? "seu cliente";
  } else {
    otherPerson = booking?.professional.user.name ?? "seu consultor";
  }

  if (!booking || !["CONFIRMED", "AWAITING_CONFIRMATION"].includes(booking.status)) notFound();
  const roomState = meetingRoomState(booking.startsAt, booking.durationMinutes);
  return <DashboardShell mode={user.role === Role.CONSULTANT ? "consultant" : "user"} title="Sua consulta">
    <div className="profile-layout">
      <section className="panel">
        <span className="eyebrow">Consulta confirmada</span>
        <h2>Você está prestes a conversar com {otherPerson}.</h2>
        <p className="muted">{shortDate(booking.startsAt)} · {booking.durationMinutes} minutos</p>
        <div className="meeting-policy">
          <strong>Sala protegida pela Insidely</strong>
          <p>{roomState === "upcoming" ? meetingRoomOpeningText(booking.startsAt) : roomState === "ended" ? "O horário de entrada da sala já terminou." : "A sala fica disponível até o fim da conversa."}</p>
        </div>
        {roomState === "open" && booking.meetingUrl ? <a className="button button-accent" href={`/sala/${booking.id}`} target="_blank" rel="noreferrer">Entrar na videochamada</a> : !booking.meetingUrl ? <p className="muted">A sala da conversa está sendo preparada.</p> : null}
        {user.role !== Role.CONSULTANT && canReviewBooking(booking.status, booking.startsAt, booking.durationMinutes) && <div className="meeting-policy"><strong>Como foi a conversa?</strong><p>Dê uma nota de 0 a 5 e, se quiser, deixe um comentário para {otherPerson}.</p><Link className="button button-accent" href="/dashboard/avaliacoes">Avaliar conversa</Link></div>}
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
