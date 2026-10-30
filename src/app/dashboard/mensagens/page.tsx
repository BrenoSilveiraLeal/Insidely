import { ConversationLink } from "@/components/conversation-link";
import { getUnreadCounts } from "@/lib/conversations";
import { ConversationReportForm, reportFeedbackText } from "@/components/conversation-safety";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chatFeedbackText } from "@/lib/chat-moderation";
import Link from "next/link";
import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { GoogleCalendarAddLink } from "@/components/google-calendar-add-link";
import { meetingRoomState } from "@/lib/booking-policy";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { meetingRoomOpeningText, money, shortDate } from "@/lib/format";
import { GoogleCalendarFeedback } from "@/components/google-calendar-feedback";

export const metadata = { title: "Mensagens" };
export const dynamic = "force-dynamic";

function requestStatus(status: string) {
  return ({ PENDING_PAYMENT: "Pedido aguardando pagamento", CONFIRMED: "Agendamento confirmado", AWAITING_CONFIRMATION: "Conversa realizada", COMPLETED: "Conversa concluída", CANCELLED: "Conversa cancelada", EXPIRED: "Pedido expirado", DISPUTED: "Pedido em análise" } as Record<string, string>)[status] ?? "Pedido de agendamento";
}

export default async function Page({ searchParams }: { searchParams: Promise<{ mensagem?: string; calendar?: string; denuncia?: string }> }) {
  const query = await searchParams;
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
  const dashboard = await getViewerDashboard(user.id);
  const requests = dashboard?.customerBookings ?? [];
  // A consultant test-booking their own profile has nobody to report.
  const { data: ownProfile } = await (await createSupabaseServerClient()).from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  const ownProfileId = ownProfile?.id;
  const unread = await getUnreadCounts(user.id, requests.flatMap((booking) => booking.conversation ? [booking.conversation.id] : []));

  return <DashboardShell mode="user" title="Mensagens" canConsultant={user.role === Role.CONSULTANT}><GoogleCalendarFeedback code={query.calendar}/>
    <div className="section-head"><p className="muted">Seus pedidos e conversas. A conversa é liberada depois que o pagamento é confirmado.</p><Link className="button button-dark" href="/dashboard/agendamentos">Ver agenda</Link></div>
    {query.mensagem && <p className="form-error" role="alert">{chatFeedbackText(query.mensagem)}</p>}
    {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
    <div className="grid grid-2">{requests.map((booking) => {
      const roomState = meetingRoomState(booking.startsAt, booking.durationMinutes);
      const paid = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"].includes(booking.status);
      const note = booking.status === "PENDING_PAYMENT" ? "O horário fica reservado enquanto você conclui o pagamento."
        : booking.status === "CANCELLED" ? "Este agendamento foi cancelado. O histórico continua disponível aqui."
        : booking.status === "EXPIRED" ? "O pagamento não foi concluído a tempo e o horário foi liberado."
        : booking.status === "DISPUTED" ? "Em análise pelo suporte."
        : booking.status === "CONFIRMED" && roomState === "upcoming" ? meetingRoomOpeningText(booking.startsAt)
        : booking.status === "CONFIRMED" && roomState === "open" ? "A sala está aberta agora."
        : null;
      return <article className="panel booking-card" key={booking.id}>
        <header className="booking-card-head">
          <span className={`booking-chip booking-chip-${booking.status.toLowerCase()}`}>{requestStatus(booking.status)}</span>
          <span className="booking-card-when">{shortDate(booking.startsAt)} · {booking.durationMinutes} min</span>
        </header>
        <div className="booking-card-person"><h2>{booking.professional.user.name}</h2><span className="booking-reputation booking-reputation-neutral">{money(booking.totalCents)}</span></div>
        {booking.goals && <blockquote className="booking-card-goals"><span>O que você quer conversar</span><p>{booking.goals}</p></blockquote>}
        {note && <p className="booking-card-note">{note}</p>}
        <div className="booking-card-actions">
          {booking.status === "PENDING_PAYMENT" && <Link className="button button-accent" href={`/checkout/${booking.id}`}>Continuar pagamento</Link>}
          {booking.status !== "CANCELLED" && booking.conversation && <ConversationLink bookingId={booking.id} unread={unread.get(booking.conversation.id) ?? 0} total={booking.conversation.messages.length}/>}
          {booking.status === "CONFIRMED" && roomState === "open" && <a className="button button-accent" href={`/sala/${booking.id}`} target="_blank" rel="noreferrer">Entrar na sala</a>}
        </div>
        {paid && <details className="booking-card-more">
          <summary>Mais opções</summary>
          <div className="booking-card-more-body">
            <div className="booking-card-option"><strong>Sala da conversa</strong><p className="muted">Link fixo da Insidely; abre o Google Meet só no horário marcado.</p><a className="text-link" href={`/sala/${booking.id}`} target="_blank" rel="noreferrer">insidely.vercel.app/sala/{booking.id.slice(0, 8)}…</a><GoogleCalendarAddLink bookingId={booking.id} returnTo="/dashboard/mensagens"/></div>
            {booking.professional.id !== ownProfileId && <ConversationReportForm bookingId={booking.id} otherName={booking.professional.user.name} returnTo="/dashboard/mensagens"/>}
          </div>
        </details>}
      </article>;
    })}</div>
    {!requests.length && <section className="panel"><h2>Nenhum pedido de agendamento</h2><p className="muted">Quando você escolher um horário, o pedido e a conversa aparecerão aqui.</p><Link className="button button-dark" href="/buscar">Encontrar profissional</Link></section>}
  </DashboardShell>;
}
