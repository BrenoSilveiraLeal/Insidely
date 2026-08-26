import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ensureGoogleMeetForBooking } from "@/lib/google-meet";
import { sendBookingConfirmationEmails } from "@/lib/email";

export const runtime = "nodejs";
type StripeObject = Stripe.Checkout.Session | Stripe.PaymentIntent | Stripe.Charge | Stripe.Transfer | Stripe.Account;

async function ensureUpdated(result: { error: { message: string } | null }, operation: string) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyBookingParticipants(supabase: any, bookingId: string) {
  const { data: booking, error } = await supabase.from("Booking").select("customerId, professional:ProfessionalProfile(userId)").eq("id", bookingId).maybeSingle();
  if (error) throw new Error(`booking_notification_lookup: ${error.message}`);
  if (!booking) return;
  const professional = Array.isArray(booking.professional) ? booking.professional[0] : booking.professional;
  const userIds = [booking.customerId, professional?.userId].filter((id, index, list): id is string => Boolean(id) && list.indexOf(id) === index);
  if (!userIds.length) return;
  const { error: insertError } = await supabase.from("Notification").insert(userIds.map((userId) => ({ id: crypto.randomUUID(), userId, title: "Pagamento confirmado", body: "Sua conversa foi confirmada. Acesse o painel para acompanhar a sala e as próximas etapas.", href: userId === booking.customerId ? "/dashboard/agendamentos" : "/consultor/consultas", createdAt: new Date().toISOString() })));
  if (insertError) throw new Error(`booking_notification_insert: ${insertError.message}`);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return Response.json({ error: "webhook_not_configured" }, { status: 400 });
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, secret); } catch { return Response.json({ error: "invalid_signature" }, { status: 400 }); }

  // Provider-specific columns are maintained by migrations and are not in the legacy generated type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { error: claimError } = await supabase.from("StripeWebhookEvent").insert({ id: event.id, type: event.type, payload: event.data.object, createdAt: new Date(event.created * 1000).toISOString(), status: "PROCESSING", attempts: 1 });
  if (claimError?.code === "23505") return Response.json({ received: true, duplicate: true });
  if (claimError) return Response.json({ error: claimError.message }, { status: 500 });

  try {
    const object = event.data.object as StripeObject;
    const metadata = "metadata" in object ? object.metadata : null;
    let bookingId = metadata?.bookingId;
    const paymentIntentRef = "payment_intent" in object && typeof object.payment_intent === "string" ? object.payment_intent : null;
    if (!bookingId && paymentIntentRef) {
      const { data: payment, error } = await supabase.from("Payment").select("bookingId").eq("stripePaymentIntentId", paymentIntentRef).maybeSingle();
      if (error) throw new Error(`payment_lookup: ${error.message}`);
      bookingId = payment?.bookingId;
    }

    if (bookingId && ["checkout.session.completed", "checkout.session.async_payment_succeeded", "payment_intent.succeeded"].includes(event.type)) {
      const sessionId = event.type.startsWith("checkout.") ? (object as Stripe.Checkout.Session).id : null;
      const paymentIntentId = event.type.startsWith("payment_intent.") ? (object as Stripe.PaymentIntent).id : (object as Stripe.Checkout.Session).payment_intent as string | null;
      await ensureUpdated(await supabase.from("Payment").update({ status: "PAID_HELD", paidAt: new Date().toISOString(), provider: "STRIPE", providerRef: paymentIntentId ?? sessionId, stripeCheckoutSessionId: sessionId, stripePaymentIntentId: paymentIntentId, updatedAt: new Date().toISOString() }).eq("bookingId", bookingId).in("status", ["PENDING", "PAYMENT_REPORTED"]), "payment_paid");
      await ensureUpdated(await supabase.from("Booking").update({ status: "CONFIRMED", paymentConfirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", bookingId).eq("status", "PENDING_PAYMENT"), "booking_confirmed");
      await notifyBookingParticipants(supabase, bookingId);
      try {
        const meetingUrl = await ensureGoogleMeetForBooking(supabase, bookingId);
        await sendBookingConfirmationEmails(supabase, bookingId, meetingUrl);
      } catch (error) {
        console.error("booking_confirmation_integrations_failed", { bookingId, error });
      }
    }

    if (bookingId && ["payment_intent.payment_failed", "checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) await ensureUpdated(await supabase.from("Payment").update({ status: "FAILED", updatedAt: new Date().toISOString() }).eq("bookingId", bookingId).in("status", ["PENDING", "PAYMENT_REPORTED"]), "payment_failed");
    if (bookingId && event.type === "charge.refunded") await ensureUpdated(await supabase.from("Payment").update({ status: "REFUNDED", updatedAt: new Date().toISOString() }).eq("bookingId", bookingId), "payment_refunded");
    if (bookingId && ["charge.dispute.created", "charge.dispute.updated"].includes(event.type)) {
      await ensureUpdated(await supabase.from("Payment").update({ status: "DISPUTED", updatedAt: new Date().toISOString() }).eq("bookingId", bookingId), "payment_disputed");
      await ensureUpdated(await supabase.from("Booking").update({ disputedAt: new Date().toISOString(), disputeReason: event.type, updatedAt: new Date().toISOString() }).eq("id", bookingId), "booking_disputed");
    }
    if (bookingId && event.type === "transfer.created") await ensureUpdated(await supabase.from("Payment").update({ stripeTransferId: (object as Stripe.Transfer).id, updatedAt: new Date().toISOString() }).eq("bookingId", bookingId), "transfer_recorded");
    if (event.type === "account.updated" || (event.type as string) === "v2.core.account.updated") {
      const account = object as Stripe.Account & { configuration?: { recipient?: { capabilities?: { stripe_balance?: { stripe_transfers?: { status?: string } } } } } };
      const transfersStatus = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
      await ensureUpdated(await supabase.from("ProfessionalProfile").update({ stripeOnboardingStatus: transfersStatus === "active" ? "COMPLETE" : "PENDING", stripeChargesEnabled: false, stripePayoutsEnabled: transfersStatus === "active", updatedAt: new Date().toISOString() }).eq("stripeAccountId", account.id), "account_status");
    }
    const { error: processedError } = await supabase.from("StripeWebhookEvent").update({ status: "PROCESSED", processedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", event.id);
    if (processedError) throw new Error(`webhook_processed: ${processedError.message}`);
    return Response.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "webhook_failed";
    await supabase.from("StripeWebhookEvent").update({ status: "FAILED", lastError: message.slice(0, 1000), updatedAt: new Date().toISOString() }).eq("id", event.id);
    console.error("stripe_webhook_failed", { stripeEventId: event.id, type: event.type, error });
    return Response.json({ error: "webhook_processing_failed" }, { status: 500 });
  }
}
