import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { money, parseDbDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Comprovante" };
export const dynamic = "force-dynamic";

const METHOD: Record<string, string> = { pix: "Pix", "credit_card": "Cartão de crédito", "debit_card": "Cartão de débito", boleto: "Boleto" };

// Payment receipt for the customer; "Imprimir ou salvar em PDF" uses the browser's print dialog.
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: booking } = await supabase.from("Booking").select("id, customerId, startsAt, durationMinutes, totalCents, feeCents, status, professionalProfileId, payment:Payment(status, provider, providerRef, paidAt)").eq("id", id).maybeSingle();
  if (!booking || booking.customerId !== user.id) notFound();
  const payment = Array.isArray(booking.payment) ? booking.payment[0] : booking.payment;
  if (!payment?.paidAt) notFound();
  const { data: card } = await supabase.from("public_profile_cards").select("user").eq("id", booking.professionalProfileId).maybeSingle();
  const consultant = (Array.isArray(card?.user) ? card.user[0]?.name : card?.user?.name) || "Consultor";
  const method = String(payment.providerRef ?? "").match(/^demo-([a-z_]+)-/)?.[1];
  const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parseDbDate(value));
  return <main className="receipt-page">
    <article className="receipt">
      <header><strong className="brand">insidely<span className="brand-dot">.</span></strong><span>Comprovante de pagamento</span></header>
      <dl>
        <div><dt>Número</dt><dd>{booking.id.slice(0, 8).toUpperCase()}</dd></div>
        <div><dt>Cliente</dt><dd>{user.name}</dd></div>
        <div><dt>Serviço</dt><dd>Conversa de {booking.durationMinutes} minutos com {consultant}</dd></div>
        <div><dt>Data da conversa</dt><dd>{date(booking.startsAt)} (horário de Brasília)</dd></div>
        <div><dt>Pago em</dt><dd>{date(payment.paidAt)}</dd></div>
        <div><dt>Forma de pagamento</dt><dd>{payment.provider === "SIMULATION" ? `${METHOD[method ?? ""] ?? "Simulação"} (simulação acadêmica)` : (METHOD[method ?? ""] ?? "Cartão")}</dd></div>
        <div><dt>Valor da conversa</dt><dd>{money(booking.totalCents - booking.feeCents)}</dd></div>
        <div><dt>Taxa da plataforma</dt><dd>{money(booking.feeCents)}</dd></div>
        <div className="receipt-total"><dt>Total pago</dt><dd>{money(booking.totalCents)}</dd></div>
        {payment.status === "REFUNDED" && <div><dt>Situação</dt><dd>Valor reembolsado</dd></div>}
      </dl>
      {payment.provider === "SIMULATION" && <p className="muted">Pagamento demonstrativo: nenhum valor real foi cobrado. Este documento não tem valor fiscal.</p>}
      <div className="receipt-actions no-print"><PrintButton/><Link className="button button-ghost" href="/dashboard/mensagens">Voltar</Link></div>
    </article>
  </main>;
}
