import "server-only";

import { getStripe } from "@/lib/stripe";
import { parseDbDate } from "@/lib/format";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { canRetryTransfer } from "@/lib/booking-policy";

// Provider columns are added by the accompanying Supabase migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StripeRow = Record<string, any>;

type StripeRecipientAccount = {
  id: string;
  configuration?: {
    recipient?: {
      capabilities?: {
        stripe_balance?: {
          stripe_transfers?: { status?: string };
        };
      };
    };
  };
};

function admin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseServiceClient() as any;
}

function recipientTransfersActive(account: StripeRecipientAccount | null | undefined) {
  return account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
}

function checkoutIntegrationIdentifier() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let index = 0; index < 8; index += 1) suffix += letters[Math.floor(Math.random() * letters.length)];
  return `insidely_checkout_${suffix}`;
}

function mockExternalIntegrationsEnabled() {
  return process.env.E2E_MOCK_EXTERNALS === "true";
}

export async function createConnectOnboardingLink({ userId, email, returnUrl, refreshUrl }: { userId: string; email: string; returnUrl: string; refreshUrl: string }) {
  const supabase = admin();
  const { data: profile, error } = await supabase.from("ProfessionalProfile").select("id, stripeAccountId").eq("userId", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Perfil profissional não encontrado.");

  const stripe = getStripe();
  let accountId = profile.stripeAccountId as string | null;
  if (!accountId) {
    const account = await stripe.v2.core.accounts.create({
      contact_email: email,
      dashboard: "express",
      identity: { country: "BR", entity_type: "individual" },
      configuration: {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
      defaults: {
        responsibilities: { fees_collector: "application", losses_collector: "application" },
      },
      metadata: { insidelyUserId: userId, professionalProfileId: profile.id },
    });
    accountId = account.id;
    await supabase.from("ProfessionalProfile").update({ stripeAccountId: accountId, stripeOnboardingStatus: "PENDING" }).eq("id", profile.id);
  } else {
    // Also upgrades existing v1 connected accounts to the v2 recipient configuration.
    await stripe.v2.core.accounts.update(accountId, {
      dashboard: "express",
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
    });
  }

  const link = await stripe.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: { configurations: ["recipient"], refresh_url: refreshUrl, return_url: returnUrl },
    },
  });
  return link.url;
}

export async function createBookingCheckout({ bookingId, customerId, customerEmail, customerName, appUrl }: { bookingId: string; customerId: string; customerEmail: string; customerName: string; appUrl: string }) {
  const supabase = admin();
  const { data: booking, error } = await supabase.from("Booking").select("id, customerId, totalCents, status, professionalProfileId, payment:Payment(*), professional:ProfessionalProfile(stripeAccountId, stripeOnboardingStatus, stripePayoutsEnabled, pixKey)").eq("id", bookingId).eq("customerId", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking || booking.status !== "PENDING_PAYMENT") throw new Error("Este agendamento não está aguardando pagamento.");
  const professional = (Array.isArray(booking.professional) ? booking.professional[0] : booking.professional) as StripeRow | null;
  if (!professional?.stripeAccountId || professional.stripeOnboardingStatus !== "COMPLETE" || !professional.stripePayoutsEnabled) throw new Error("O consultor ainda não está habilitado para receber pagamentos.");
  if (mockExternalIntegrationsEnabled()) {
    const sessionId = `cs_e2e_${booking.id}`;
    await supabase.from("Payment").update({ provider: "STRIPE", providerRef: sessionId, stripeCheckoutSessionId: sessionId, updatedAt: new Date().toISOString() }).eq("bookingId", booking.id).eq("status", "PENDING");
    return `${appUrl}/checkout/${booking.id}?status=mock_checkout_started`;
  }
  const stripe = getStripe();
  const account = await stripe.v2.core.accounts.retrieve(professional.stripeAccountId, { include: ["configuration.recipient"] });
  if (!recipientTransfersActive(account)) throw new Error("O consultor ainda não está habilitado para receber pagamentos.");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    integration_identifier: checkoutIntegrationIdentifier(),
    customer_email: customerEmail,
    client_reference_id: booking.id,
    line_items: [{ price_data: { currency: "brl", product_data: { name: "Conversa profissional Insidely", description: `Consulta com ${customerName}` }, unit_amount: booking.totalCents }, quantity: 1 }],
    metadata: { bookingId: booking.id, customerId },
    payment_intent_data: { metadata: { bookingId: booking.id, customerId } },
    success_url: `${appUrl}/checkout/${booking.id}?status=success`,
    cancel_url: `${appUrl}/checkout/${booking.id}?status=cancelled`,
  }, { idempotencyKey: `insidely-checkout-${booking.id}` });
  await supabase.from("Payment").update({ provider: "STRIPE", providerRef: session.id, stripeCheckoutSessionId: session.id, updatedAt: new Date().toISOString() }).eq("bookingId", booking.id).eq("status", "PENDING");
  return session.url;
}

export async function releaseBookingTransfer(bookingId: string) {
  const supabase = admin();
  const { data: booking, error } = await supabase.from("Booking").select("id, status, totalCents, feeCents, professionalProfileId, customerConfirmedAt, consultantConfirmedAt, disputedAt, autoReleaseAt, startsAt, durationMinutes, payment:Payment(*), professional:ProfessionalProfile(stripeAccountId)").eq("id", bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) return false;
  const payment = (Array.isArray(booking.payment) ? booking.payment[0] : booking.payment) as StripeRow | null;
  const professional = (Array.isArray(booking.professional) ? booking.professional[0] : booking.professional) as StripeRow | null;
  if (!payment) return false;
  if (payment.stripeTransferId) return true;
  // No Pix key yet: the value stays held (the daily job reminds the consultant and retries).
  if (!String(professional?.pixKey ?? "").trim()) return false;
  if (payment.status === "RELEASED") return payment.provider === "SIMULATION";
  if (!canRetryTransfer(booking.status, payment.status)) return false;
  if (booking.disputedAt) return false;
  const bothParticipantsConfirmed = Boolean(booking.customerConfirmedAt && booking.consultantConfirmedAt);
  const autoReleaseAt = booking.autoReleaseAt ?? new Date(parseDbDate(booking.startsAt).getTime() + (Number(booking.durationMinutes) + 1440) * 60_000).toISOString();
  const safetyDeadlineReached = new Date(autoReleaseAt).getTime() <= Date.now();
  if (!bothParticipantsConfirmed && !safetyDeadlineReached) return false;
  if (!professional?.stripeAccountId) throw new Error("Conta Stripe do consultor ausente.");
  // After a partial refund decided by support, the consultant receives the share that was not given back.
  // Read on its own so transfers keep working before migration 20261101120000 adds the column.
  const { data: refundRow } = await supabase.from("Booking").select("refundedCents").eq("id", booking.id).maybeSingle();
  const total = Number(booking.totalCents);
  const refunded = Number((refundRow as { refundedCents?: number } | null)?.refundedCents ?? 0);
  const amount = Math.round((total - Number(booking.feeCents)) * (total - refunded) / total);
  if (amount <= 0) throw new Error("Valor de repasse inválido.");
  const idempotencyKey = `insidely-transfer-${booking.id}`;
  const { data: previousAttempt, error: previousAttemptError } = await supabase.from("TransferAttempt").select("id, attemptCount").eq("idempotencyKey", idempotencyKey).maybeSingle();
  if (previousAttemptError) throw new Error(previousAttemptError.message);
  const attemptId = previousAttempt?.id ?? crypto.randomUUID();
  const attemptCount = Number(previousAttempt?.attemptCount ?? 0) + 1;
  const attemptMutation = previousAttempt
    ? supabase.from("TransferAttempt").update({ status: "PROCESSING", attemptCount, lastError: null, nextRetryAt: null, updatedAt: new Date().toISOString() }).eq("id", attemptId)
    : supabase.from("TransferAttempt").insert({ id: attemptId, paymentId: payment.id, bookingId: booking.id, idempotencyKey, status: "PROCESSING", attemptCount });
  const { error: attemptError } = await attemptMutation;
  if (attemptError) throw new Error(attemptError.message);
  const { error: processingError } = await supabase.from("Payment").update({ status: "TRANSFER_PROCESSING", updatedAt: new Date().toISOString() }).eq("bookingId", booking.id).in("status", ["HELD", "PAID_HELD", "TRANSFER_FAILED"]);
  if (processingError) throw new Error(processingError.message);
  try {
    if (mockExternalIntegrationsEnabled() && process.env.E2E_TRANSFER_MODE === "fail-once" && attemptCount === 1) throw new Error("e2e_transfer_failed_once");
    const transfer = mockExternalIntegrationsEnabled()
      ? { id: `tr_e2e_${booking.id}` }
      : await getStripe().transfers.create({ amount, currency: "brl", destination: professional.stripeAccountId, transfer_group: `booking_${booking.id}`, metadata: { bookingId: booking.id } }, { idempotencyKey });
    const { error: updateError } = await supabase.from("Payment").update({ status: "RELEASED", releasedAt: new Date().toISOString(), stripeTransferId: transfer.id, updatedAt: new Date().toISOString() }).eq("bookingId", booking.id).eq("status", "TRANSFER_PROCESSING");
    if (updateError) throw new Error(updateError.message);
    await supabase.from("TransferAttempt").update({ status: "SUCCEEDED", stripeTransferId: transfer.id, updatedAt: new Date().toISOString() }).eq("id", attemptId);
    await supabase.from("Booking").update({ status: "COMPLETED", updatedAt: new Date().toISOString() }).eq("id", booking.id).in("status", ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"]);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "transfer_failed";
    await supabase.from("Payment").update({ status: "TRANSFER_FAILED", updatedAt: new Date().toISOString() }).eq("bookingId", booking.id).in("status", ["HELD", "PAID_HELD", "TRANSFER_PROCESSING", "TRANSFER_FAILED"]);
    await supabase.from("TransferAttempt").update({ status: "FAILED", lastError: message.slice(0, 1000), nextRetryAt: new Date(Date.now() + 15 * 60_000).toISOString(), updatedAt: new Date().toISOString() }).eq("id", attemptId);
    throw error;
  }
}

// `customerNotice` replaces the "the consultant cancelled" text, e.g. when the account was suspended.
// removeSlot: the slot is deleted instead of opening again (the consultant is not available then).
export async function cancelBookingAndRefund({ bookingId, consultantId, reason, customerNotice, removeSlot = false }: { bookingId: string; consultantId: string; reason: string; customerNotice?: string; removeSlot?: boolean }) {
  const supabase = admin();
  const { data: profile, error: profileError } = await supabase.from("ProfessionalProfile").select("id").eq("userId", consultantId).maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("Perfil profissional não encontrado.");
  const { data: booking, error } = await supabase.from("Booking").select("id, customerId, availabilityId, startsAt, status, totalCents, format, conversation:Conversation(id), payment:Payment(*)").eq("id", bookingId).eq("professionalProfileId", profile.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) throw new Error("Conversa não encontrada.");
  // A chat can be declined until the consultant's first answer; an old video conversation until it starts.
  const conversationId = (Array.isArray(booking.conversation) ? booking.conversation[0] : booking.conversation)?.id as string | undefined;
  const answered = booking.format === "MESSAGE" && conversationId ? Boolean((await supabase.from("Message").select("id", { count: "exact", head: true }).eq("conversationId", conversationId).eq("senderId", consultantId).eq("automatic", false)).count) : false;
  const tooLate = booking.format === "MESSAGE" ? answered : parseDbDate(booking.startsAt).getTime() <= Date.now();
  if (!["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) || tooLate) throw new Error("Esta conversa não pode mais ser cancelada pelo consultor.");
  const payment = (Array.isArray(booking.payment) ? booking.payment[0] : booking.payment) as StripeRow | null;
  const paid = ["PAID_HELD", "HELD", "APPROVED"].includes(String(payment?.status));
  if (paid && payment?.provider === "STRIPE" && !payment.stripePaymentIntentId) throw new Error("O pagamento não tem uma referência segura para reembolso.");
  if (paid && payment?.provider === "STRIPE" && payment.stripePaymentIntentId) {
    await getStripe().refunds.create({ payment_intent: payment.stripePaymentIntentId, reason: "requested_by_customer", metadata: { bookingId, reason: reason.slice(0, 500) } }, { idempotencyKey: `insidely-refund-${bookingId}` });
  }
  const now = new Date().toISOString();
  const { error: bookingError } = await supabase.from("Booking").update({ status: "CANCELLED", updatedAt: now }).eq("id", bookingId).in("status", ["PENDING_PAYMENT", "CONFIRMED"]);
  if (bookingError) throw new Error(bookingError.message);
  if (payment && paid) {
    const { error: paymentError } = await supabase.from("Payment").update({ status: "REFUNDED", updatedAt: now }).eq("id", payment.id).in("status", ["PAID_HELD", "HELD", "APPROVED"]);
    if (paymentError) throw new Error(paymentError.message);
  }
  if (booking.availabilityId) {
    const { error: availabilityError } = removeSlot
      ? await supabase.from("Availability").delete().eq("id", booking.availabilityId)
      : await supabase.from("Availability").update({ isBooked: false }).eq("id", booking.availabilityId);
    if (availabilityError) throw new Error(availabilityError.message);
  }
  const { error: notificationError } = await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: booking.customerId, title: "Conversa cancelada e reembolso iniciado", body: `${customerNotice ?? "O consultor cancelou a conversa."} ${paid ? "O valor integral será devolvido pelo meio de pagamento usado." : "Como o pagamento ainda não havia sido confirmado, nenhuma cobrança foi concluída."}`, href: "/dashboard/agendamentos", createdAt: now });
  if (notificationError) throw new Error(notificationError.message);
  return { customerId: booking.customerId, refunded: paid };
}

// A chat cancelled by the customer before the consultant's first answer: the whole amount goes back
// (customer_cancel_chat, migration 20261110100000, checks the answer and records the refund).
export async function refundChatInFull({ bookingId, customerId }: { bookingId: string; customerId: string }) {
  const supabase = admin();
  const { data: booking, error } = await supabase.from("Booking").select("customerId, format, payment:Payment(*)").eq("id", bookingId).eq("customerId", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!booking) throw new Error("Conversa não encontrada.");
  const payment = (Array.isArray(booking.payment) ? booking.payment[0] : booking.payment) as StripeRow | null;
  const paid = ["PAID_HELD", "HELD", "APPROVED"].includes(String(payment?.status));
  if (paid && payment?.provider === "STRIPE" && !mockExternalIntegrationsEnabled()) {
    if (!payment.stripePaymentIntentId) throw new Error("O pagamento não tem uma referência segura para reembolso.");
    await getStripe().refunds.create({ payment_intent: payment.stripePaymentIntentId, reason: "requested_by_customer", metadata: { bookingId, reason: "chat_cancelled_before_answer" } }, { idempotencyKey: `insidely-chat-cancel-${bookingId}` });
  }
}

// Chats the consultant did not answer within 24 hours of the customer's first message (or that stayed
// without any message for 72 hours):
// full refund, the booking is cancelled (which closes the chat) and both sides are told. Runs before
// any release of the payment to the consultant (booking maintenance and the daily job).
export async function refundUnansweredMessageBookings() {
  const supabase = admin();
  const { data: rows, error } = await supabase.from("Booking")
    .select("id, customerId, startsAt, durationMinutes, professionalProfile:ProfessionalProfile(userId), conversation:Conversation(id), payment:Payment(*)")
    .eq("format", "MESSAGE").in("status", ["CONFIRMED", "AWAITING_CONFIRMATION"]).is("disputedAt", null)
    .lte("startsAt", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
  if (error) throw new Error(error.message);
  let refunded = 0;
  for (const booking of (rows ?? []) as StripeRow[]) {
    const one = (value: StripeRow | StripeRow[] | null) => Array.isArray(value) ? value[0] ?? null : value;
    const consultantId = one(booking.professionalProfile)?.userId as string | undefined;
    const conversationId = one(booking.conversation)?.id as string | undefined;
    if (!consultantId || !conversationId) continue;
    // Automatic messages (the welcome message) are not answers.
    const { count, error: countError } = await supabase.from("Message").select("id", { count: "exact", head: true }).eq("conversationId", conversationId).eq("senderId", consultantId).eq("automatic", false);
    if (countError || count) continue;
    // The 24 hours count from the customer's first message; with no message, the chat waits until 72 hours.
    const { data: firstQuestion } = await supabase.from("Message").select("createdAt").eq("conversationId", conversationId).eq("senderId", booking.customerId).order("createdAt", { ascending: true }).limit(1).maybeSingle();
    const deadline = firstQuestion ? parseDbDate(firstQuestion.createdAt).getTime() + 24 * 60 * 60_000 : parseDbDate(booking.startsAt).getTime() + 72 * 60 * 60_000;
    if (deadline > Date.now()) continue;
    try {
      const payment = one(booking.payment);
      const paid = ["PAID_HELD", "HELD", "APPROVED"].includes(String(payment?.status));
      if (paid && payment?.provider === "STRIPE") {
        if (!payment.stripePaymentIntentId) throw new Error("missing_payment_intent");
        await getStripe().refunds.create({ payment_intent: payment.stripePaymentIntentId, reason: "requested_by_customer", metadata: { bookingId: booking.id, reason: "message_unanswered" } }, { idempotencyKey: `insidely-unanswered-${booking.id}` });
      }
      const now = new Date().toISOString();
      const { data: cancelled } = await supabase.from("Booking").update({ status: "CANCELLED", updatedAt: now }).eq("id", booking.id).in("status", ["CONFIRMED", "AWAITING_CONFIRMATION"]).select("id").maybeSingle();
      if (!cancelled) continue;
      if (payment && paid) await supabase.from("Payment").update({ status: "REFUNDED", updatedAt: now }).eq("id", payment.id).in("status", ["PAID_HELD", "HELD", "APPROVED"]);
      await supabase.from("Notification").insert([
        { id: crypto.randomUUID(), userId: booking.customerId, title: "Chat sem resposta: valor devolvido", body: "O consultor não respondeu dentro de 24 horas. O valor integral será devolvido pelo meio de pagamento usado e o chat foi encerrado.", href: "/dashboard/agendamentos", createdAt: now },
        { id: crypto.randomUUID(), userId: consultantId, title: "Chat encerrado sem resposta", body: "O prazo de 24 horas terminou sem resposta no chat. O cliente recebeu o valor de volta e o chat foi encerrado.", href: "/consultor/consultas", createdAt: now },
      ]);
      refunded++;
    } catch (refundError) {
      console.error("message_refund_failed", { bookingId: booking.id, error: refundError });
    }
  }
  return refunded;
}
