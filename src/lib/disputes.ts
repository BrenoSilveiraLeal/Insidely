import "server-only";
import { warnAccount } from "@/lib/enforcement";
import { getStripe } from "@/lib/stripe";
import { releaseBookingTransfer } from "@/lib/stripe-payments";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// The decision on a contested conversation (Booking DISPUTED), by an admin or the support staff
// member who took the case:
// - REFUND: the customer gets the full amount back, the booking is cancelled and, unless unticked,
//   the consultant receives a warning (graduated enforcement, lib/enforcement.ts);
// - RELEASE: the contest is closed and the amount goes to the consultant as usual.
export async function resolveDispute({ bookingId, decision, staffUserId, note, warnConsultant }: { bookingId: string; decision: "REFUND" | "RELEASE"; staffUserId: string; note: string; warnConsultant: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: booking } = await supabase.from("Booking").select("id, status, customerId, format, professionalProfile:ProfessionalProfile(userId), payment:Payment(*)").eq("id", bookingId).maybeSingle();
  if (!booking || booking.status !== "DISPUTED") throw new Error("Esta contestação já foi decidida.");
  const one = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] ?? null : value;
  const payment = one(booking.payment) as Record<string, unknown> | null;
  const consultantId = (one(booking.professionalProfile) as { userId?: string } | null)?.userId ?? null;
  const now = new Date().toISOString();
  const what = booking.format === "MESSAGE" ? "pedido de perguntas por mensagem" : "conversa";

  if (decision === "REFUND") {
    if (payment?.provider === "STRIPE" && payment.stripePaymentIntentId) {
      await getStripe().refunds.create({ payment_intent: String(payment.stripePaymentIntentId), reason: "requested_by_customer", metadata: { bookingId, reason: "dispute_refund" } }, { idempotencyKey: `insidely-dispute-refund-${bookingId}` });
    }
    await supabase.from("Booking").update({ status: "CANCELLED", updatedAt: now }).eq("id", bookingId).eq("status", "DISPUTED");
    if (payment) await supabase.from("Payment").update({ status: "REFUNDED", updatedAt: now }).eq("id", payment.id);
    await supabase.from("Notification").insert([
      { id: crypto.randomUUID(), userId: booking.customerId, title: "Contestação aceita: valor devolvido", body: `A equipe da Insidely analisou o seu ${what} e decidiu devolver o valor integral pelo meio de pagamento usado. ${note}`.trim(), href: "/dashboard/agendamentos", createdAt: now },
      ...(consultantId ? [{ id: crypto.randomUUID(), userId: consultantId, title: "Contestação aceita: valor devolvido ao cliente", body: `A equipe analisou o ${what} e o valor foi devolvido ao cliente. ${note}`.trim(), href: "/consultor/consultas", createdAt: now }] : []),
    ]);
    if (warnConsultant && consultantId) await warnAccount(supabase, { userId: consultantId, adminUserId: staffUserId, reason: `Contestação aceita: ${note || `o ${what} não atendeu ao que foi combinado`}`.slice(0, 500).padEnd(10, ".") });
    return { refunded: true };
  }

  // RELEASE: back to "awaiting release" with the safety window over, then the usual release.
  await supabase.from("Booking").update({ status: "AWAITING_CONFIRMATION", disputedAt: null, autoReleaseAt: now, updatedAt: now }).eq("id", bookingId).eq("status", "DISPUTED");
  if (payment?.status === "DISPUTED") await supabase.from("Payment").update({ status: "PAID_HELD", updatedAt: now }).eq("id", payment.id);
  if (payment?.provider === "SIMULATION") {
    await supabase.from("Payment").update({ status: "RELEASED", releasedAt: now, updatedAt: now }).eq("id", payment.id);
    await supabase.from("Booking").update({ status: "COMPLETED", updatedAt: now }).eq("id", bookingId);
  } else {
    await releaseBookingTransfer(bookingId).catch((error) => console.error("dispute_release_failed", { bookingId, error }));
  }
  await supabase.from("Notification").insert([
    { id: crypto.randomUUID(), userId: booking.customerId, title: "Contestação analisada", body: `A equipe da Insidely analisou o seu ${what} e entendeu que ele foi realizado como combinado. ${note}`.trim(), href: "/dashboard/agendamentos", createdAt: now },
    ...(consultantId ? [{ id: crypto.randomUUID(), userId: consultantId, title: "Contestação encerrada a seu favor", body: `A equipe analisou o ${what} e o valor segue para o seu repasse. ${note}`.trim(), href: "/consultor/ganhos", createdAt: now }] : []),
  ]);
  return { refunded: false };
}
