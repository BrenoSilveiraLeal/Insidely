import { getBookingForUser } from "@/lib/queries";
import { BookingStatus } from "@/lib/domain";
import { payBookingAction } from "@/app/actions";
import { PublicShell } from "@/components/public-shell";
import { money, shortDate } from "@/lib/format";

import { requireUser } from "@/lib/session";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const booking = await getBookingForUser(id, user.id);
  if (!booking) notFound();
  return <PublicShell>
    <section className="page-hero" data-mark="R$"><div className="container page-hero-inner"><span className="eyebrow">Pagamento protegido</span><h1>Seu pagamento fica retido até a conversa acontecer.</h1><p>A Insidely só prevê o repasse ao consultor depois da confirmação ou do prazo de segurança, sem contestação.</p></div></section>
    <section className="section"><div className="container profile-layout">
      <div className="panel"><span className="eyebrow">Resumo transparente</span><ul className="detail-list"><li><span>Profissional</span><strong>{booking.professional.user.name}</strong></li><li><span>Data</span><strong>{shortDate(booking.startsAt)}</strong></li><li><span>Duração</span><strong>{booking.durationMinutes} min</strong></li><li><span>Você paga</span><strong>{money(booking.totalCents)}</strong></li><li><span>Repasse previsto ao consultor</span><strong>{money(booking.totalCents - booking.feeCents)}</strong></li><li><span>Taxa da plataforma</span><strong>{money(booking.feeCents)}</strong></li></ul><div className="meeting-policy"><span>◉</span><div><strong>Google Meet com acesso protegido</strong><p>Quando a integração Google estiver conectada, a plataforma criará uma sala única para este encontro. Até lá, esta é uma simulação funcional do fluxo.</p></div></div><div className="meeting-policy"><span>✓</span><div><strong>Proteção depois da conversa</strong><p>Os dois lados podem confirmar a realização. Sem contestação, o sistema prevê liberação automática em até 24 horas.</p></div></div></div>
      <aside className="booking-box"><span className="eyebrow">Pagamento na plataforma</span><h2>Confirmar pagamento</h2>{booking.status === BookingStatus.PENDING_PAYMENT ? <form className="form-stack" action={payBookingAction.bind(null, booking.id)}><div className="field"><label htmlFor="paymentMethod">Método</label><select className="select" id="paymentMethod" name="paymentMethod" defaultValue="pix"><option value="pix">Pix</option><option value="card">Cartão</option></select><small>Checkout demonstrativo: nenhum dinheiro real será cobrado nesta versão.</small></div><label className="consent-option"><input name="recordingConsent" type="checkbox" required /><span><strong>Concordo com os termos da conversa e o registro de presença.</strong><small>Gravação só pode ocorrer se os dois participantes derem consentimento específico.</small></span></label><button className="button button-accent button-block" type="submit">Pagar e reter valor com segurança</button></form> : <p className="status">Pagamento {booking.payment?.status === "HELD" ? "retido" : booking.payment?.status.toLowerCase()}</p>}<p className="muted" style={{fontSize:12}}>No lançamento, esta etapa será conectada a um provedor de pagamentos marketplace autorizado.</p></aside>
    </div></section>
  </PublicShell>;
}
