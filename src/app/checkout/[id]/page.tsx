import { getBookingForUser } from "@/lib/queries";
import { BookingStatus } from "@/lib/domain";
import { simulateBookingPaymentAction } from "@/app/actions";
import Link from "next/link";
import { SimulatedCheckoutForm } from "@/components/simulated-checkout-form";
import { PublicShell } from "@/components/public-shell";
import { dateTimeInBrazil, money, shortDate } from "@/lib/format";
import { Bell, CalendarDays, Check, Video } from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { GoogleCalendarAddLink } from "@/components/google-calendar-add-link";
import { meetingRoomState, paymentDeadline, holdMinutesFor } from "@/lib/booking-policy";
import { requireUser } from "@/lib/session";
import { notFound } from "next/navigation";

export const metadata = { title: "Pagamento" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; erro?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  // getViewerDashboard already expires stale unpaid bookings before reading.
  const booking = await getBookingForUser(id, user.id);
  if (!booking) notFound();
  const paid = booking.payment?.status === "PAID_HELD" || booking.payment?.status === "HELD" || booking.payment?.status === "RELEASED";
  // "Perguntas por mensagem": no call time or video room; the chat opens for 48 hours once paid.
  const isMessage = (booking as typeof booking & { format?: string }).format === "MESSAGE";
  const roomState = meetingRoomState(booking.startsAt, booking.durationMinutes);
  const deadline = paymentDeadline(booking.createdAt, booking.startsAt, booking.durationMinutes, holdMinutesFor(isMessage ? "MESSAGE" : null));
  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Demonstração de pagamento</span><h1>{paid ? "Conversa confirmada." : "Confirme sua conversa."}</h1><p>{paid ? "Tudo certo. Abaixo estão o resumo, a sala e os próximos passos." : "Este checkout é uma simulação acadêmica: nenhum valor será cobrado. Escolha um meio para demonstrar a confirmação do agendamento."}</p></div></section>
    <section className="section"><div className="container profile-layout checkout-layout">
      <div className="panel checkout-summary"><span className="eyebrow">Resumo da conversa</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li>{isMessage ? <><li><span>Formato</span><strong>Perguntas por mensagem</strong></li><li><span>Como funciona</span><strong>Até 5 mensagens · respostas em até 48h</strong></li></> : <><li><span>Data</span><strong>{shortDate(booking.startsAt)}</strong></li><li><span>Duração</span><strong>{booking.durationMinutes} min</strong></li></>}<li><span>Valor da conversa</span><strong>{money(booking.totalCents - booking.feeCents)}</strong></li><li><span>Taxa Insidely</span><strong>{money(booking.feeCents)}</strong></li><li><span>Total</span><strong>{money(booking.totalCents)}</strong></li><li><span>Forma de pagamento</span><strong>Simulação, sem cobrança</strong></li></ul>{!paid && <div className="meeting-policy"><span>•</span><div><strong>Confirmação imediata</strong><p>Ao confirmar, a conversa será marcada como paga e confirmada no sistema. Nenhum dado de cartão, boleto ou Pix será solicitado.</p></div></div>}{!paid && booking.status === BookingStatus.PENDING_PAYMENT && <div className="checkout-rules"><strong>Retenção e reembolso</strong><p className="muted checkout-rules-text">Em pagamentos reais, o valor fica retido pela plataforma at&eacute; cliente e consultor confirmarem a conversa. Se algu&eacute;m esquecer, a libera&ccedil;&atilde;o autom&aacute;tica ocorre ap&oacute;s 24 horas do fim previsto, salvo contesta&ccedil;&atilde;o. Antes de pagar, consulte as <Link className="text-link" href="/termos" target="_blank">regras de cancelamento e reembolso</Link>: cancelamento pelo cliente dentro de 24 horas do início tem taxa de 10%; se o consultor cancelar, o reembolso é integral.</p></div>}</div>
      <aside className="booking-box"><span className="eyebrow">Checkout demonstrativo</span>{paid ? <div className="checkout-success"><span className="checkout-success-icon" aria-hidden="true"><Check size={22}/></span><div><h2>Pagamento aprovado</h2><p className="muted">Sua conversa com {booking.professional.user.name} está confirmada.</p></div></div> : <h2>{query.status === "cancelled" ? "Pagamento cancelado" : "Escolha como pagar"}</h2>}{query.erro && <p className="form-error" role="alert">{query.erro}</p>}{paid ? <div className="checkout-done">
        <ul className="checkout-facts">
          {isMessage ? <>
            <li><CalendarDays size={18} aria-hidden="true"/><div><strong>Chat aberto</strong><span>Até {dateTimeInBrazil(new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000))}</span></div></li>
            <li><Bell size={18} aria-hidden="true"/><div><strong>Como funciona</strong><span>A primeira pergunta chega ao consultor agora; as outras, uma a uma, quando ele termina de responder a anterior. Sem resposta em 48 horas, o valor volta para você.</span></div></li>
          </> : <>
          <li><CalendarDays size={18} aria-hidden="true"/><div><strong>Quando</strong><span>{dateTimeInBrazil(booking.startsAt)} · {booking.durationMinutes} min</span></div></li>
          <li><Video size={18} aria-hidden="true"/><div><strong>Sala</strong><span>{roomState === "ended" ? "O horário da sala já terminou." : roomState === "open" ? "A sala está aberta agora." : "Abre no horário marcado, pelo link da Insidely."}</span>{roomState !== "ended" && <CopyLinkButton href={`/sala/${booking.id}`} label="Copiar link da sala"/>}</div></li>
          {roomState === "upcoming" && <li><Bell size={18} aria-hidden="true"/><div><strong>Lembrete</strong><span>Por e-mail e no app, cerca de 1 hora antes.</span></div></li>}
          </>}
        </ul>
        <div className="checkout-actions"><Link className="button button-dark button-block" href={`/conversa/${booking.id}`}>{isMessage ? "Enviar minhas perguntas" : "Abrir o chat da conversa"}</Link>{!isMessage && roomState !== "ended" && <GoogleCalendarAddLink bookingId={booking.id} returnTo="/dashboard/agendamentos" className="button button-ghost button-block"/>}</div>
      </div> : booking.status === BookingStatus.PENDING_PAYMENT ? <><p className="muted">Você tem até {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(deadline)} para confirmar o pagamento{isMessage ? "" : "; até lá o horário fica reservado para você e some das opções de outras pessoas. Sem pagamento, ele volta para o perfil"}.</p><SimulatedCheckoutForm bookingId={booking.id} action={simulateBookingPaymentAction.bind(null, booking.id)} /></> : booking.status === BookingStatus.EXPIRED ? <p className="status">Este agendamento expirou antes da confirmação do pagamento. O horário foi liberado e o registro permanece no histórico.</p> : <p className="status">Este agendamento não está disponível para pagamento.</p>}</aside>
    </div></section>
  </PublicShell>;
}
