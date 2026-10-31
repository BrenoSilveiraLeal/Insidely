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
import { meetingRoomState, paymentDeadline } from "@/lib/booking-policy";
import { requireUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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
  const deadline = paymentDeadline(booking.createdAt, booking.startsAt, booking.durationMinutes);
  // The slot stays open until paid: someone else may have paid for it while this request waited.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: slotRow } = booking.status === BookingStatus.PENDING_PAYMENT && !isMessage ? await (createSupabaseServiceClient() as any).from("Booking").select("professionalProfileId, slot:Availability(isBooked)").eq("id", booking.id).maybeSingle() : { data: null };
  const slotTaken = Boolean((Array.isArray(slotRow?.slot) ? slotRow.slot[0] : slotRow?.slot)?.isBooked);
  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Demonstração de pagamento</span><h1>{paid ? "Conversa confirmada." : "Confirme sua conversa."}</h1><p>{paid ? "Tudo certo. Abaixo estão o resumo, a sala e os próximos passos." : "Este checkout é uma simulação acadêmica: nenhum valor será cobrado. Escolha um meio para demonstrar a confirmação do agendamento."}</p></div></section>
    <section className="section"><div className="container profile-layout">
      <div className="panel"><span className="eyebrow">Resumo da conversa</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li>{isMessage ? <><li><span>Formato</span><strong>Perguntas por mensagem</strong></li><li><span>Como funciona</span><strong>Até 5 mensagens · respostas em até 48h</strong></li></> : <><li><span>Data</span><strong>{shortDate(booking.startsAt)}</strong></li><li><span>Duração</span><strong>{booking.durationMinutes} min</strong></li></>}<li><span>Valor da conversa</span><strong>{money(booking.totalCents - booking.feeCents)}</strong></li><li><span>Taxa Insidely</span><strong>{money(booking.feeCents)}</strong></li><li><span>Total</span><strong>{money(booking.totalCents)}</strong></li><li><span>Forma de pagamento</span><strong>Simulação, sem cobrança</strong></li></ul>{!paid && <div className="meeting-policy"><span>•</span><div><strong>Confirmação imediata</strong><p>Ao confirmar, a conversa será marcada como paga e confirmada no sistema. Nenhum dado de cartão, boleto ou Pix será solicitado.</p></div></div>}</div>
      <aside className="booking-box"><span className="eyebrow">Checkout demonstrativo</span>{paid ? <div className="checkout-success"><span className="checkout-success-icon" aria-hidden="true"><Check size={22}/></span><div><h2>Pagamento aprovado</h2><p className="muted">Sua conversa com {booking.professional.user.name} está confirmada.</p></div></div> : <h2>{query.status === "cancelled" ? "Pagamento cancelado" : "Escolha como pagar"}</h2>}{query.erro && <p className="form-error" role="alert">{query.erro}</p>}{paid ? <div className="checkout-done">
        <ul className="checkout-facts">
          {isMessage ? <>
            <li><CalendarDays size={18} aria-hidden="true"/><div><strong>Chat aberto</strong><span>Até {dateTimeInBrazil(new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000))}</span></div></li>
            <li><Bell size={18} aria-hidden="true"/><div><strong>Como funciona</strong><span>Suas perguntas chegam ao consultor numa única mensagem. As respostas chegam no chat em até 48 horas; sem resposta, o valor volta para você.</span></div></li>
          </> : <>
          <li><CalendarDays size={18} aria-hidden="true"/><div><strong>Quando</strong><span>{dateTimeInBrazil(booking.startsAt)} · {booking.durationMinutes} min</span></div></li>
          <li><Video size={18} aria-hidden="true"/><div><strong>Sala</strong><span>{roomState === "ended" ? "O horário da sala já terminou." : roomState === "open" ? "A sala está aberta agora." : "Abre no horário marcado, pelo link da Insidely."}</span>{roomState !== "ended" && <CopyLinkButton href={`/sala/${booking.id}`} label="Copiar link da sala"/>}</div></li>
          {roomState === "upcoming" && <li><Bell size={18} aria-hidden="true"/><div><strong>Lembrete</strong><span>Por e-mail e no app, cerca de 1 hora antes.</span></div></li>}
          </>}
        </ul>
        <div className="checkout-actions"><Link className="button button-dark button-block" href={`/conversa/${booking.id}`}>{isMessage ? "Enviar minhas perguntas" : "Abrir o chat da conversa"}</Link>{!isMessage && roomState !== "ended" && <GoogleCalendarAddLink bookingId={booking.id} returnTo="/dashboard/agendamentos" className="button button-ghost button-block"/>}</div>
      </div> : booking.status === BookingStatus.PENDING_PAYMENT ? <><p className="muted">Você tem até {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(deadline)} para confirmar o pagamento.</p><p className="muted">Em pagamentos reais, o valor fica retido pela plataforma at&eacute; cliente e consultor confirmarem a conversa. Se algu&eacute;m esquecer, a libera&ccedil;&atilde;o autom&aacute;tica ocorre ap&oacute;s 24 horas do fim previsto, salvo contesta&ccedil;&atilde;o. Antes de pagar, consulte as <Link className="text-link" href="/termos" target="_blank">regras de cancelamento e reembolso</Link>: cancelamento pelo cliente dentro de 24 horas do início tem taxa de 10%; se o consultor cancelar, o reembolso é integral.</p>{slotTaken ? <div className="panel form-stack" role="alert"><strong>Esse horário acabou de ser reservado por outra pessoa.</strong><p className="muted">Nada foi cobrado. Os horários só ficam reservados depois do pagamento; escolha outro horário no perfil.</p><Link className="button button-dark" href={`/profissional/${slotRow.professionalProfileId}`}>Escolher outro horário</Link></div> : <SimulatedCheckoutForm bookingId={booking.id} action={simulateBookingPaymentAction.bind(null, booking.id)} />}</> : booking.status === BookingStatus.EXPIRED ? <p className="status">Este agendamento expirou antes da confirmação do pagamento. O horário foi liberado e o registro permanece no histórico.</p> : <p className="status">Este agendamento não está disponível para pagamento.</p>}</aside>
    </div></section>
  </PublicShell>;
}
