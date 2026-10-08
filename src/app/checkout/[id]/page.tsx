import { getBookingForUser } from "@/lib/queries";
import { BookingStatus } from "@/lib/domain";
import { simulateBookingPaymentAction } from "@/app/actions";
import { PublicShell } from "@/components/public-shell";
import { money, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string; erro?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const booking = await getBookingForUser(id, user.id);
  if (!booking) notFound();
  const meetingUrl = (booking as typeof booking & { meetingUrl?: string | null }).meetingUrl;
  const paid = booking.payment?.status === "PAID_HELD" || booking.payment?.status === "HELD" || booking.payment?.status === "RELEASED";
  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Demonstração de pagamento</span><h1>Confirme sua conversa.</h1><p>Este checkout é uma simulação acadêmica: nenhum valor será cobrado. Escolha um meio para demonstrar a confirmação do agendamento.</p></div></section>
    <section className="section"><div className="container profile-layout">
      <div className="panel"><span className="eyebrow">Resumo da conversa</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li><li><span>Data</span><strong>{shortDate(booking.startsAt)}</strong></li><li><span>Duração</span><strong>{booking.durationMinutes} min</strong></li><li><span>Valor demonstrativo</span><strong>{money(booking.totalCents)}</strong></li><li><span>Forma de pagamento</span><strong>Simulação, sem cobrança</strong></li></ul><div className="meeting-policy"><span>•</span><div><strong>Confirmação imediata</strong><p>Ao confirmar, a conversa será marcada como paga e confirmada no sistema. Nenhum dado de cartão, boleto ou Pix será solicitado.</p></div></div></div>
      <aside className="booking-box"><span className="eyebrow">Checkout demonstrativo</span><h2>{paid ? "Pagamento confirmado" : query.status === "cancelled" ? "Pagamento cancelado" : "Escolha como pagar"}</h2>{query.erro && <p className="form-error" role="alert">{query.erro}</p>}{paid ? <><p className="status">Pagamento simulado confirmado. O agendamento está confirmado.</p>{meetingUrl ? <a className="button button-accent button-block" href={meetingUrl} target="_blank" rel="noreferrer">Abrir Google Meet</a> : <p className="muted" style={{fontSize:12}}>A sala do Google Meet será exibida quando as credenciais Google estiverem configuradas.</p>}</> : booking.status === BookingStatus.PENDING_PAYMENT ? <form action={simulateBookingPaymentAction.bind(null, booking.id)} className="form-stack"><label className="field"><span>Forma de pagamento</span><select className="select" name="method" defaultValue="PIX" required><option value="PIX">Pix</option><option value="CREDIT_CARD">Cartão de crédito</option><option value="DEBIT_CARD">Cartão de débito</option><option value="BOLETO">Boleto</option></select></label><button className="button button-accent button-block" type="submit">Confirmar pagamento simulado</button><p className="muted" style={{fontSize:12}}>Esta ação não acessa a Stripe e não movimenta dinheiro.</p></form> : <p className="status">Este agendamento não está disponível para pagamento.</p>}</aside>
    </div></section>
  </PublicShell>;
}
