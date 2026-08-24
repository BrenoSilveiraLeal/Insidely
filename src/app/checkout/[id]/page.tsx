import { getBookingForUser } from "@/lib/queries";
import { BookingStatus } from "@/lib/domain";
import { createStripeCheckoutAction } from "@/app/actions";
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
  const paid = booking.payment?.status === "PAID_HELD" || booking.payment?.status === "HELD" || booking.payment?.status === "RELEASED";
  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Pagamento seguro</span><h1>Confirme sua conversa com pagamento protegido.</h1><p>O pagamento é processado pelo Stripe. O repasse ao consultor só acontece depois da confirmação da conversa ou do prazo de segurança.</p></div></section>
    <section className="section"><div className="container profile-layout">
      <div className="panel"><span className="eyebrow">Resumo transparente</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li><li><span>Data</span><strong>{shortDate(booking.startsAt)}</strong></li><li><span>Duração</span><strong>{booking.durationMinutes} min</strong></li><li><span>Você paga</span><strong>{money(booking.totalCents)}</strong></li><li><span>Repasse previsto ao consultor</span><strong>{money(booking.totalCents - booking.feeCents)}</strong></li><li><span>Taxa da plataforma</span><strong>{money(booking.feeCents)}</strong></li></ul><div className="meeting-policy"><span>•</span><div><strong>Pagamento aprovado → conversa → repasse</strong><p>O Stripe confirma o pagamento por webhook. A aplicação nunca libera acesso apenas porque o cliente voltou para a tela de sucesso.</p></div></div></div>
      <aside className="booking-box"><span className="eyebrow">Checkout Stripe</span><h2>{paid ? "Pagamento confirmado" : query.status === "cancelled" ? "Pagamento cancelado" : "Finalizar pagamento"}</h2>{query.erro && <p className="form-error" role="alert">{query.erro}</p>}{paid ? <p className="status">Pagamento confirmado e retido com segurança. O agendamento está confirmado.</p> : booking.status === BookingStatus.PENDING_PAYMENT ? <form action={createStripeCheckoutAction.bind(null, booking.id)}><button className="button button-accent button-block" type="submit">Pagar com Stripe</button><p className="muted" style={{fontSize:12, marginTop:12}}>Você será levado para uma página segura do Stripe. Cartão e Pix podem aparecer conforme a configuração da sua conta.</p></form> : <p className="status">Este agendamento não está disponível para pagamento.</p>}<p className="muted" style={{fontSize:12}}>O pagamento real exige que o consultor tenha concluído o cadastro de recebimentos.</p></aside>
    </div></section>
  </PublicShell>;
}
