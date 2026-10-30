import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parseDbDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { CONFIRMED: "Confirmada", AWAITING_CONFIRMATION: "Realizada", COMPLETED_RELEASE_PENDING: "Concluída (repasse pendente)", COMPLETED: "Concluída", DISPUTED: "Em análise", CANCELLED: "Cancelada" };

// The consultant's earnings as a CSV spreadsheet (opens in Excel / Google Sheets).
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "CONSULTANT") return new Response("Não autorizado", { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  const { data: bookings } = profile ? await supabase.from("Booking").select("startsAt, durationMinutes, status, totalCents, feeCents, payment:Payment(status)").eq("professionalProfileId", profile.id).in("status", Object.keys(STATUS)).order("startsAt", { ascending: false }) : { data: [] };
  const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const lines = [["Data", "Duração (min)", "Situação", "Valor pago pelo cliente (R$)", "Taxa Insidely (R$)", "Seu valor (R$)", "Pagamento"].join(";")];
  for (const row of (bookings ?? []) as { startsAt: string; durationMinutes: number; status: string; totalCents: number; feeCents: number; payment: { status: string } | { status: string }[] | null }[]) {
    const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
    const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parseDbDate(row.startsAt));
    const cancelled = row.status === "CANCELLED";
    lines.push([date, row.durationMinutes, STATUS[row.status] ?? row.status, money(row.totalCents), money(row.feeCents), cancelled ? "0,00" : money(row.totalCents - row.feeCents), payment?.status ?? ""].join(";"));
  }
  // BOM so Excel reads the accents as UTF-8.
  return new Response("﻿" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="insidely-ganhos.csv"`, "Cache-Control": "private, no-store" } });
}
