import Stripe from "stripe";

let client: Stripe | undefined;

export function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_SECRET_KEY não configurada.");
  client ??= new Stripe(secret, { typescript: true });
  return client;
}

export function getStripePublicKey() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY não configurada.");
  return key;
}

// The checkout still runs as a demonstration (simulateBookingPaymentAction): nothing is charged.
// Turn on together with the Stripe checkout; /admin/status shows red until then.
export const STRIPE_CHECKOUT_ENABLED = false;

// For /admin/status: whether real payments go through Stripe and what is missing for it.
export function checkStripe() {
  const keys = { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET };
  const missing = Object.entries(keys).filter(([, value]) => !value).map(([name]) => name);
  const mode = keys.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "produção" : keys.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "teste" : null;
  const keysText = missing.length ? `Faltam na Vercel: ${missing.join(", ")}.` : `Chaves configuradas${mode ? ` (modo ${mode})` : ""}.`;
  if (!STRIPE_CHECKOUT_ENABLED) return { ok: false, message: `NÃO IMPLEMENTADO: o checkout real pelo Stripe ainda falta ser ligado. Por enquanto os pagamentos são simulados e nenhuma cobrança real é feita. ${keysText}` };
  return { ok: missing.length === 0 && mode === "produção", message: missing.length ? `Pagamentos reais não funcionam. ${keysText}` : mode === "produção" ? "Pagamentos reais ativos pelo Stripe." : `Em modo ${mode ?? "desconhecido"}: as cobranças não são reais.` };
}
