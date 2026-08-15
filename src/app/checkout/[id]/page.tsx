import { BookingStatus } from "@prisma/client";
import { payBookingAction } from "@/app/actions";
import { PublicShell } from "@/components/public-shell";
import { money, shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const booking = await prisma.booking.findFirst({ where: { id, customerId: user.id }, include: { professional: { include: { user: true } }, payment: true } });
  if (!booking) notFound();
  const professionalShare = booking.subtotalCents - booking.feeCents;
  const platformPercent = Math.round((booking.feeCents / booking.subtotalCents) * 100);

  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Pagamento da conversa</span><h1>Confirme o encontro.</h1><p>Escolha Pix ou cartão. O acesso à conversa só é liberado após a confirmação.</p></div></section>
    <section className="section"><div className="container profile-layout">
      <div className="panel"><span className="eyebrow">Resumo transparente</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li><li><span>Data</span><strong>{shortDate(booking.startsAt)}</strong></li><li><span>Duração</span><strong>{booking.durationMinutes} min</strong></li><li><span>Total da conversa</span><strong>{money(booking.totalCents)}</strong></li><li><span>Repasse ao profissional · {100 - platformPercent}%</span><strong>{money(professionalShare)}</strong></li><li><span>Insidely · {platformPercent}%</span><strong>{money(booking.feeCents)}</strong></li></ul><div className="meeting-policy"><span>◉</span><div><strong>Conversa por Google Meet, com proteção da Insidely</strong><p>A sala é liberada 15 minutos antes do horário. Entrada, saída e duração serão registradas como evidência em pedidos de suporte ou reembolso.</p></div></div></div>
      <aside className="booking-box"><span className="eyebrow">Forma de pagamento</span><h2>Pix ou cartão</h2><p>A cobrança permanece em modo de testes até a conta de pagamentos da Insidely ser vinculada.</p>{booking.status === BookingStatus.PENDING_PAYMENT ? <form className="form-stack" action={payBookingAction.bind(null, booking.id)}><label className="payment-option"><input name="paymentMethod" type="radio" value="pix" defaultChecked /><span><strong>Pix</strong><small>Confirmação rápida e QR Code na versão integrada</small></span></label><label className="payment-option"><input name="paymentMethod" type="radio" value="card" /><span><strong>Cartão</strong><small>Crédito ou débito compatível</small></span></label><label className="consent-option"><input name="recordingConsent" type="checkbox" required /><span><strong>Concordo com o registro de presença.</strong><small>Se houver gravação, ela só inicia com o aceite dos dois participantes e é usada apenas para segurança e mediação de disputas.</small></span></label><button className="button button-accent button-block" type="submit">Confirmar pagamento de teste</button></form> : <p className="status">Consulta {booking.status.toLowerCase()}</p>}</aside>
    </div></section>
  </PublicShell>;
}
