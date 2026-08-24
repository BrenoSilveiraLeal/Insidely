import { startStripeConnectOnboardingAction } from "@/app/actions";

export function StripeConnectSetup() {
  return <section className="panel"><span className="eyebrow">Recebimentos</span><h2>Configure seus repasses</h2><p className="muted">O Stripe verifica seus dados bancários e fiscais para que a Insidely possa repassar o valor das conversas. Você será redirecionado para uma página segura do Stripe.</p><form action={startStripeConnectOnboardingAction}><button className="button button-accent" type="submit">Configurar recebimentos</button></form></section>;
}
