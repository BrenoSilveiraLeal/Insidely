import { getBookingForUser } from "@/lib/queries";
import { BookingStatus } from "@/lib/domain";
import { simulateBookingPaymentAction } from "@/app/actions";
import Link from "next/link";
import { SimulatedCheckoutForm } from "@/components/simulated-checkout-form";
import { PublicShell } from "@/components/public-shell";
import { dateTimeInBrazil, money } from "@/lib/format";
import { Bell, CalendarDays, Check } from "lucide-react";
import { CHAT_FIRST_ANSWER_HOURS, paymentDeadline, holdMinutesFor } from "@/lib/booking-policy";
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
  // The chat opens as soon as it is paid (no time slot).
  const deadline = paymentDeadline(booking.createdAt, booking.startsAt, booking.durationMinutes, holdMinutesFor("MESSAGE"));
  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Demonstração de pagamento</span><h1>{paid ? "Conversa confirmada." : "Confirme sua conversa."}</h1><p>{paid ? "Tudo certo. O chat já está aberto." : "Este checkout é uma simulação acadêmica: nenhum valor será cobrado. Escolha um meio para demonstrar a confirmação do pedido."}</p></div></section>
    <section className="section"><div className="container profile-layout checkout-layout">
      <div className="panel checkout-summary"><span className="eyebrow">Resumo da conversa</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li><li><span>Formato</span><strong>Chat</strong></li><li><span>Como funciona</span><strong>Abre na hora · resposta em até {CHAT_FIRST_ANSWER_HOURS}h após sua mensagem</strong></li><li><span>Valor da conversa</span><strong>{money(booking.totalCents - booking.feeCents)}</strong></li><li><span>Taxa Insidely</span><strong>{money(booking.feeCents)}</strong></li><li><span>Total</span><strong>{money(booking.totalCents)}</strong></li><li><span>Forma de pagamento</span><strong>Simulação, sem cobrança</strong></li></ul>{!paid && <div className="meeting-policy"><span>•</span><div><strong>Confirmação imediata</strong><p>Ao confirmar, a conversa será marcada como paga e confirmada no sistema. Nenhum dado de cartão, boleto ou Pix será solicitado.</p></div></div>}{!paid && booking.status === BookingStatus.PENDING_PAYMENT && <div className="checkout-rules"><strong>Retenção e reembolso</strong><p className="muted checkout-rules-text">O valor fica retido pela Insidely e só vai para o consultor quando você confirma que suas dúvidas foram respondidas ou, depois que o chat fecha, se você não contestar em 24 horas. Se o consultor não responder em {CHAT_FIRST_ANSWER_HOURS} horas depois da sua primeira mensagem, o valor volta integralmente. Veja as <Link className="text-link" href="/termos" target="_blank">regras de reembolso</Link>.</p></div>}</div>
      <aside className="booking-box"><span className="eyebrow">Checkout demonstrativo</span>{paid ? <div className="checkout-success"><span className="checkout-success-icon" aria-hidden="true"><Check size={22}/></span><div><h2>Pagamento aprovado</h2><p className="muted">Sua conversa com {booking.professional.user.name} está confirmada.</p></div></div> : <h2>{query.status === "cancelled" ? "Pagamento cancelado" : "Escolha como pagar"}</h2>}{query.erro && <p className="form-error" role="alert">{query.erro}</p>}{paid ? <div className="checkout-done">
        <ul className="checkout-facts">
          <li><CalendarDays size={18} aria-hidden="true"/><div><strong>Chat aberto</strong><span>Até {dateTimeInBrazil(new Date(booking.startsAt.getTime() + booking.durationMinutes * 60_000))}</span></div></li>
          <li><Bell size={18} aria-hidden="true"/><div><strong>Como funciona</strong><span>Abra o chat e escreva sua primeira mensagem. O consultor tem {CHAT_FIRST_ANSWER_HOURS} horas para responder depois dela; sem resposta, o valor volta para você.</span></div></li>
        </ul>
        <div className="checkout-actions"><Link className="button button-dark button-block" href={`/conversa/${booking.id}`}>Abrir o chat</Link></div>
      </div> : booking.status === BookingStatus.PENDING_PAYMENT ? <><p className="muted">Você tem até {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(deadline)} para confirmar o pagamento.</p><SimulatedCheckoutForm bookingId={booking.id} action={simulateBookingPaymentAction.bind(null, booking.id)} /></> : booking.status === BookingStatus.EXPIRED ? <p className="status">Este pedido expirou antes da confirmação do pagamento. O registro permanece no histórico.</p> : <p className="status">Este pedido não está disponível para pagamento.</p>}</aside>
    </div></section>
  </PublicShell>;
}
