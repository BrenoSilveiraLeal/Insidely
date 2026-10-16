import { getBookingForUser } from "@/lib/queries";
import { BookingStatus } from "@/lib/domain";
import { simulateBookingPaymentAction } from "@/app/actions";
import Link from "next/link";
import { MeetingRoomMessage } from "@/components/meeting-room-message";
import { SimulatedCheckoutForm } from "@/components/simulated-checkout-form";
import { PublicShell } from "@/components/public-shell";
import { meetingRoomOpeningText, money, shortDate } from "@/lib/format";
import { meetingRoomState, paymentDeadline } from "@/lib/booking-policy";
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
  const meetingUrl = (booking as typeof booking & { meetingUrl?: string | null }).meetingUrl;
  const paid = booking.payment?.status === "PAID_HELD" || booking.payment?.status === "HELD" || booking.payment?.status === "RELEASED";
  const roomState = meetingRoomState(booking.startsAt, booking.durationMinutes);
  const deadline = paymentDeadline(booking.createdAt, booking.startsAt, booking.durationMinutes);
  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Demonstração de pagamento</span><h1>Confirme sua conversa.</h1><p>Este checkout é uma simulação acadêmica: nenhum valor será cobrado. Escolha um meio para demonstrar a confirmação do agendamento.</p></div></section>
    <section className="section"><div className="container profile-layout">
      <div className="panel"><span className="eyebrow">Resumo da conversa</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li><li><span>Data</span><strong>{shortDate(booking.startsAt)}</strong></li><li><span>Duração</span><strong>{booking.durationMinutes} min</strong></li><li><span>Valor da conversa</span><strong>{money(booking.totalCents - booking.feeCents)}</strong></li><li><span>Taxa Insidely</span><strong>{money(booking.feeCents)}</strong></li><li><span>Total</span><strong>{money(booking.totalCents)}</strong></li><li><span>Forma de pagamento</span><strong>Simulação, sem cobrança</strong></li></ul><div className="meeting-policy"><span>•</span><div><strong>Confirmação imediata</strong><p>Ao confirmar, a conversa será marcada como paga e confirmada no sistema. Nenhum dado de cartão, boleto ou Pix será solicitado.</p></div></div></div>
      <aside className="booking-box"><span className="eyebrow">Checkout demonstrativo</span><h2>{paid ? "Pagamento aprovado ✓" : query.status === "cancelled" ? "Pagamento cancelado" : "Escolha como pagar"}</h2>{query.erro && <p className="form-error" role="alert">{query.erro}</p>}{paid ? <><p className="status">Pagamento aprovado ✓ O agendamento está confirmado.</p>{roomState === "ended" ? <p className="muted">O horário de entrada da sala já terminou.</p> : <MeetingRoomMessage booking={{ ...booking, meetingUrl: meetingUrl ?? null }} />}{roomState === "upcoming" && <p className="muted">{meetingRoomOpeningText(booking.startsAt)} Você também recebe um lembrete por e-mail e no app cerca de 1 hora antes.</p>}<Link className="button button-dark button-block" href="/dashboard/mensagens">Abrir o chat da conversa</Link></> : booking.status === BookingStatus.PENDING_PAYMENT ? <><p className="muted">Você tem até {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(deadline)} para confirmar o pagamento.</p><SimulatedCheckoutForm bookingId={booking.id} action={simulateBookingPaymentAction.bind(null, booking.id)} /></> : booking.status === BookingStatus.EXPIRED ? <p className="status">Este agendamento expirou antes da confirmação do pagamento. O horário foi liberado e o registro permanece no histórico.</p> : <p className="status">Este agendamento não está disponível para pagamento.</p>}</aside>
    </div></section>
  </PublicShell>;
}
