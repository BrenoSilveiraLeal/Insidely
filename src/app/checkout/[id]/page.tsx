import { BookingStatus } from "@prisma/client";
import { payBookingAction } from "@/app/actions";
import { PublicShell } from "@/components/public-shell";
import { money, shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { DirectPixCheckout } from "@/components/direct-pix-checkout";
import { directPixPayload } from "@/lib/pix";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const booking = await prisma.booking.findFirst({ where: { id, customerId: user.id }, include: { professional: { include: { user: true } }, payment: true } });
  if (!booking) notFound();
  const pixKey = booking.professional.pixKey;
  const pixPayload = pixKey ? directPixPayload({ key: pixKey, name: booking.professional.user.name, city: booking.professional.location, amount: booking.totalCents / 100 }) : null;

  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Pagamento da conversa</span><h1>Confirme o encontro.</h1><p>Faça o Pix diretamente para o profissional e envie a confirmação. A liberação é manual nesta etapa do projeto.</p></div></section>
    <section className="section"><div className="container profile-layout">
      <div className="panel"><span className="eyebrow">Resumo transparente</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li><li><span>Data</span><strong>{shortDate(booking.startsAt)}</strong></li><li><span>Duração</span><strong>{booking.durationMinutes} min</strong></li><li><span>Total da conversa</span><strong>{money(booking.totalCents)}</strong></li><li><span>Destino</span><strong>Pix direto ao profissional</strong></li></ul><div className="meeting-policy"><span>◉</span><div><strong>Conversa por Google Meet, com proteção da Insidely</strong><p>A sala é liberada após o profissional confirmar o recebimento. Entrada, saída e duração ficam registradas para suporte.</p></div></div></div>
      <aside className="booking-box"><span className="eyebrow">Pagamento direto</span><h2>Pague por Pix</h2>{booking.status === BookingStatus.PENDING_PAYMENT ? pixPayload ? <><DirectPixCheckout payload={pixPayload}/><form className="form-stack" action={payBookingAction.bind(null, booking.id)}><input type="hidden" name="paymentMethod" value="direct_pix"/><label className="consent-option"><input name="recordingConsent" type="checkbox" required /><span><strong>Concordo com o registro de presença.</strong><small>Se houver gravação, ela só inicia com o aceite dos dois participantes.</small></span></label><button className="button button-accent button-block" type="submit">Informar que fiz o Pix</button></form></> : <p className="form-error">Este profissional ainda não cadastrou uma chave Pix. Escolha outro perfil ou tente novamente mais tarde.</p> : <p className="status">Consulta {booking.status.toLowerCase()}</p>}</aside>
    </div></section>
  </PublicShell>;
}
