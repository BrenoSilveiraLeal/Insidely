import { TwoColumns } from "@/components/two-columns";
import { compareBookingsForList, canReviewBooking, paymentDeadline, holdMinutesFor } from "@/lib/booking-policy";
import { markPageNotificationsRead } from "@/lib/nav-badges";
import { ConversationLink } from "@/components/conversation-link";
import { getUnreadCounts } from "@/lib/conversations";
import { BlockUserForm, ConversationReportForm, reportFeedbackText } from "@/components/conversation-safety";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chatFeedbackText } from "@/lib/chat-moderation";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import { Role } from "@/lib/domain";
import { getBlockedBookingIds } from "@/lib/blocks";
import { DashboardShell } from "@/components/dashboard-shell";
import { ArchiveAppointmentButton } from "@/components/appointment-history-card";
import { getViewerDashboard } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { paginate } from "@/lib/paginate";
import { PaginationControls } from "@/components/pagination-controls";
import { initials, money, shortDate } from "@/lib/format";

export const metadata = { title: "Mensagens" };
export const dynamic = "force-dynamic";

function chatStatus(status: string) {
  return ({ PENDING_PAYMENT: "Aguardando pagamento", CONFIRMED: "Chat aberto", AWAITING_CONFIRMATION: "Chat encerrado", COMPLETED_RELEASE_PENDING: "Concluído", COMPLETED: "Concluído", CANCELLED: "Cancelado", EXPIRED: "Pedido expirado", DISPUTED: "Em análise" } as Record<string, string>)[status] ?? "Pedido";
}

// The customer's chats (the only conversation format), newest activity first, each with the
// consultant's photo, or an anonymous avatar when the consultant hides their identity.
export default async function Page({ searchParams }: { searchParams: Promise<{ mensagem?: string; denuncia?: string; bloqueio?: string; page?: string; cancelamento?: string; contestacao?: string }> }) {
  const query = await searchParams;
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  // Opening the page counts its notifications as seen (the menu count goes away).
  await Promise.all([markPageNotificationsRead(user.id, "/dashboard/mensagens"), markPageNotificationsRead(user.id, "/dashboard/agendamentos")]);
  const dashboard = await getViewerDashboard(user.id);
  const requests = [...(dashboard?.customerBookings ?? [])].sort(compareBookingsForList);
  // A consultant test-booking their own profile has nobody to report or review.
  const { data: ownProfile } = await (await createSupabaseServerClient()).from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  const ownProfileId = ownProfile?.id;
  const shown = paginate(requests, query.page, 12);
  const blockedBookings = await getBlockedBookingIds(user.id, requests.map((booking) => booking.id));
  const unread = await getUnreadCounts(user.id, requests.flatMap((booking) => booking.conversation ? [booking.conversation.id] : []));

  return <DashboardShell mode="user" title="Mensagens" canConsultant={user.role === Role.CONSULTANT}>
    <div className="section-head"><p className="muted">Seus chats com profissionais. O chat abre assim que o pagamento é confirmado.</p><Link className="button button-dark" href="/buscar">Encontrar profissional</Link></div>
    {query.mensagem && <p className="form-error" role="alert">{chatFeedbackText(query.mensagem)}</p>}
    {query.denuncia && <p className={query.denuncia === "ok" ? "form-feedback" : "form-error"} role={query.denuncia === "ok" ? "status" : "alert"}>{reportFeedbackText(query.denuncia)}</p>}
    {query.bloqueio && <p className="form-feedback" role="status">{query.bloqueio === "removido" ? "Bloqueio removido. Vocês voltam a poder conversar." : "Pessoa bloqueada. Vocês não conseguem mais abrir novos chats um com o outro."}</p>}
    {query.contestacao === "ok" && <p className="form-feedback" role="status">Contestação registrada. O suporte vai analisar o caso.</p>}
    <TwoColumns className="booking-grid">{shown.items.map((booking) => {
      const paid = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED", "DISPUTED"].includes(booking.status);
      const isChat = booking.format === "MESSAGE";
      const anonymous = booking.professional.privacyMode === "PSEUDONYM";
      const image = booking.professional.user.image;
      const note = booking.status === "PENDING_PAYMENT" ? `Conclua o pagamento até ${shortDate(paymentDeadline(booking.createdAt, booking.startsAt, booking.durationMinutes, holdMinutesFor("MESSAGE")))} para abrir o chat.`
        : booking.status === "CANCELLED" ? "Chat cancelado. Se você já tinha pago, o valor foi devolvido."
        : booking.status === "EXPIRED" ? "O pagamento não foi concluído a tempo."
        : booking.status === "DISPUTED" ? "Em análise pelo suporte. O valor continua retido."
        : isChat && booking.status === "CONFIRMED" ? `Chat aberto até ${shortDate(new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000))}.`
        : booking.status === "AWAITING_CONFIRMATION" && booking.autoReleaseAt ? `Chat encerrado. Se algo ficou sem resposta, conteste no chat até ${shortDate(booking.autoReleaseAt)}.`
        : !isChat ? "Conversa antiga, feita por vídeo." : null;
      return <article className="panel booking-card" key={booking.id}>
        <header className="booking-card-head">
          <span className="booking-card-chips"><span className={`booking-chip booking-chip-${booking.status.toLowerCase()}`}>{chatStatus(booking.status)}</span>{anonymous && <span className="format-chip">Perfil anônimo</span>}</span>
          <span className="booking-card-when">{shortDate(booking.startsAt)}</span>
        </header>
        <div className="booking-card-person chat-card-person">
          {image ? <span className="conversation-avatar avatar-photo" style={{ backgroundImage: `url(${image})` }} aria-hidden="true"/> : <span className="conversation-avatar" aria-hidden="true">{anonymous ? <EyeOff size={18}/> : initials(booking.professional.user.name)}</span>}
          <h2>{booking.professional.user.name}</h2>
          <span className="booking-reputation booking-reputation-neutral">{money(booking.totalCents)}</span>
        </div>
        {note && <p className="booking-card-note">{note}</p>}
        <div className="booking-card-actions">
          {booking.status === "PENDING_PAYMENT" && <Link className="button button-accent" href={`/checkout/${booking.id}`}>Continuar pagamento</Link>}
          {booking.status !== "CANCELLED" && booking.status !== "EXPIRED" && booking.conversation && <ConversationLink bookingId={booking.id} unread={unread.get(booking.conversation.id) ?? 0} total={booking.conversation.messages.length}/>}
          {canReviewBooking(booking.status, booking.startsAt, booking.durationMinutes) && booking.status === "COMPLETED" && booking.professional.id !== ownProfileId && !booking.review && <Link className="button button-ghost" href="/dashboard/avaliacoes">Avaliar</Link>}
        </div>
        {(paid || ["COMPLETED", "CANCELLED", "EXPIRED"].includes(booking.status)) && <details className="booking-card-more">
          <summary>Mais opções</summary>
          <div className="booking-card-more-body">
            {paid && <div className="booking-card-option"><strong>Comprovante</strong><p className="muted">Recibo do pagamento para imprimir ou salvar em PDF.</p><Link className="text-link" href={`/recibo/${booking.id}`} target="_blank">Ver comprovante</Link></div>}
            {paid && booking.professional.id !== ownProfileId && <div className="conversation-safety-row"><ConversationReportForm bookingId={booking.id} otherName={booking.professional.user.name} returnTo="/dashboard/mensagens"/><BlockUserForm bookingId={booking.id} otherName={booking.professional.user.name} returnTo="/dashboard/mensagens" blocked={blockedBookings.has(booking.id)}/></div>}
            {["COMPLETED", "COMPLETED_RELEASE_PENDING", "CANCELLED", "EXPIRED"].includes(booking.status) && <ArchiveAppointmentButton id={booking.id}/>}
          </div>
        </details>}
      </article>;
    })}</TwoColumns>
    <PaginationControls page={shown.page} total={shown.total} pageSize={shown.pageSize} basePath="/dashboard/mensagens"/>
    {!requests.length && <section className="panel empty-state"><h2>Nenhum chat ainda</h2><p className="muted">Encontre um profissional e abra um chat: ele abre assim que o pagamento é confirmado.</p><Link className="button button-dark" href="/buscar">Encontrar profissional</Link></section>}
  </DashboardShell>;
}
