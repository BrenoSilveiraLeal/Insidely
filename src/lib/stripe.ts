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
