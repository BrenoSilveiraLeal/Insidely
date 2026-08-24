import "server-only";

import { getStripe } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Provider columns are added by the accompanying Supabase migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeRow = Record<string, any>;

function admin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseServiceClient() as any;
}

export async function createConnectOnboardingLink({ userId, email, returnUrl, refreshUrl }: { userId: string; email: string; returnUrl: string; refreshUrl: string }) {
  const supabase = admin();
  const { data: profile, error } = await supabase.from("ProfessionalProfile").select("id, stripeAccountId").eq("userId", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Perfil profissional não encontrado.");

  const stripe = getStripe();
  let accountId = profile.stripeAccountId as string | null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "BR",
      email,
      business_type: "individual",
      capabilities: { transfers: { requested: true } },
      metadata: { insidelyUserId: userId, professionalProfileId: profile.id },
    });
    accountId = account.id;
    await supabase.from("ProfessionalProfile").update({ stripeAccountId: accountId, stripeOnboardingStatus: "PENDING" }).eq("id", profile.id);
  }

  const link = await stripe.accountLinks.create({ account: accountId, type: "account_onboarding", refresh_url: refreshUrl, return_url: returnUrl });
  return link.url;
}

export async function createBookingCheckout({ bookingId, customerId, customerEmail, customerName, appUrl }: { bookingId: string; customerId: string; customerEmail: string; customerName: string; appUrl: string }) {
  const supabase = admin();
  const { data: booking, error } = await supabase.from("Booking").select("id, customerId, totalCents, status, professionalProfileId, payment:Payment(*), professional:ProfessionalProfile(stripeAccountId, stripeOnboardingStatus, stripePayoutsEnabled)").eq("id", bookingId).eq("customerId", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking || booking.status !== "PENDING_PAYMENT") throw new Error("Este agendamento não está aguardando pagamento.");
  const professional = (Array.isArray(booking.professional) ? booking.professional[0] : booking.professional) as StripeRow | null;
  if (!professional?.stripeAccountId || professional.stripeOnboardingStatus !== "COMPLETE" || !professional.stripePayoutsEnabled) throw new Error("O consultor ainda não está habilitado para receber pagamentos.");
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card", "pix"],
    customer_email: customerEmail,
    client_reference_id: booking.id,
    line_items: [{ price_data: { currency: "brl", product_data: { name: "Conversa profissional Insidely", description: `Consulta com ${customerName}` }, unit_amount: booking.totalCents }, quantity: 1 }],
    metadata: { bookingId: booking.id, customerId },
    payment_intent_data: { metadata: { bookingId: booking.id, customerId } },
    success_url: `${appUrl}/checkout/${booking.id}?status=success`,
    cancel_url: `${appUrl}/checkout/${booking.id}?status=cancelled`,
  });
  await supabase.from("Payment").update({ provider: "STRIPE", providerRef: session.id, stripeCheckoutSessionId: session.id, updatedAt: new Date().toISOString() }).eq("bookingId", booking.id).eq("status", "PENDING");
  return session.url;
}

export async function releaseBookingTransfer(bookingId: string) {
  const supabase = admin();
  const { data: booking, error } = await supabase.from("Booking").select("id, status, totalCents, feeCents, professionalProfileId, payment:Payment(*), professional:ProfessionalProfile(stripeAccountId)").eq("id", bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) return false;
  const payment = (Array.isArray(booking.payment) ? booking.payment[0] : booking.payment) as StripeRow | null;
  const professional = (Array.isArray(booking.professional) ? booking.professional[0] : booking.professional) as StripeRow | null;
  if (!payment || payment.stripeTransferId || payment.status === "RELEASED") return true;
  if (booking.status !== "COMPLETED" || !["HELD", "PAID_HELD"].includes(payment.status)) return false;
  if (!professional?.stripeAccountId) throw new Error("Conta Stripe do consultor ausente.");
  const amount = Number(booking.totalCents) - Number(booking.feeCents);
  if (amount <= 0) throw new Error("Valor de repasse inválido.");
  const transfer = await getStripe().transfers.create({ amount, currency: "brl", destination: professional.stripeAccountId, transfer_group: `booking_${booking.id}`, metadata: { bookingId: booking.id } }, { idempotencyKey: `insidely-transfer-${booking.id}` });
  const { error: updateError } = await supabase.from("Payment").update({ status: "RELEASED", releasedAt: new Date().toISOString(), stripeTransferId: transfer.id, updatedAt: new Date().toISOString() }).eq("bookingId", booking.id).in("status", ["HELD", "PAID_HELD"]);
  if (updateError) throw new Error(updateError.message);
  await supabase.from("Booking").update({ status: "COMPLETED", updatedAt: new Date().toISOString() }).eq("id", booking.id).in("status", ["AWAITING_CONFIRMATION", "COMPLETED"]);
  return true;
}
