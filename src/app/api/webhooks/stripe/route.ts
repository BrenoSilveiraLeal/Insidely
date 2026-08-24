import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return Response.json({ error: "webhook_not_configured" }, { status: 400 });
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, secret); } catch { return Response.json({ error: "invalid_signature" }, { status: 400 }); }
  // The migration adds provider-specific columns beyond the generated legacy type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { error: eventError } = await supabase.from("StripeWebhookEvent").insert({ id: event.id, type: event.type, payload: event.data.object, createdAt: new Date(event.created * 1000).toISOString() });
  if (eventError?.code === "23505") return Response.json({ received: true, duplicate: true });
  if (eventError) return Response.json({ error: eventError.message }, { status: 500 });

  const object = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent | Stripe.Charge | Stripe.Transfer;
  const metadata = "metadata" in object ? object.metadata : null;
  const bookingId = metadata?.bookingId;
  if (bookingId && ["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"].includes(event.type)) {
    const sessionId = event.type.startsWith("checkout.") ? (object as Stripe.Checkout.Session).id : null;
    const paymentIntentId = event.type.startsWith("payment_intent.") ? (object as Stripe.PaymentIntent).id : (object as Stripe.Checkout.Session).payment_intent as string | null;
    await supabase.from("Payment").update({ status: "PAID_HELD", paidAt: new Date().toISOString(), provider: "STRIPE", providerRef: paymentIntentId ?? sessionId, stripeCheckoutSessionId: sessionId, stripePaymentIntentId: paymentIntentId, updatedAt: new Date().toISOString() }).eq("bookingId", bookingId).in("status", ["PENDING", "PAYMENT_REPORTED"]);
    await supabase.from("Booking").update({ status: "CONFIRMED", paymentConfirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", bookingId).eq("status", "PENDING_PAYMENT");
  }
  if (bookingId && event.type === "charge.refunded") await supabase.from("Payment").update({ status: "REFUNDED", updatedAt: new Date().toISOString() }).eq("bookingId", bookingId);
  if (bookingId && ["charge.dispute.created", "charge.dispute.updated"].includes(event.type)) await supabase.from("Payment").update({ status: "DISPUTED", updatedAt: new Date().toISOString() }).eq("bookingId", bookingId);
  if (bookingId && event.type === "transfer.created") await supabase.from("Payment").update({ stripeTransferId: (object as Stripe.Transfer).id, updatedAt: new Date().toISOString() }).eq("bookingId", bookingId);
  if (event.type === "account.updated") {
    const account = object as unknown as Stripe.Account;
    await supabase.from("ProfessionalProfile").update({ stripeOnboardingStatus: account.details_submitted ? "COMPLETE" : "PENDING", stripeChargesEnabled: account.charges_enabled, stripePayoutsEnabled: account.payouts_enabled, updatedAt: new Date().toISOString() }).eq("stripeAccountId", account.id);
  }
  return Response.json({ received: true });
}
