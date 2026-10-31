import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parseDbDate } from "@/lib/format";
import { buildBrandedWorkbook, xlsxResponse } from "@/lib/branded-sheet";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { CONFIRMED: "Confirmada", AWAITING_CONFIRMATION: "Realizada", COMPLETED_RELEASE_PENDING: "Concluída (repasse pendente)", COMPLETED: "Concluída", DISPUTED: "Em análise", CANCELLED: "Cancelada" };

// The consultant's earnings as an Insidely-branded Excel sheet (opens in Excel / Google Sheets).
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "CONSULTANT") return new Response("Não autorizado", { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  const { data: bookings } = profile ? await supabase.from("Booking").select("startsAt, durationMinutes, status, totalCents, feeCents, payment:Payment(status)").eq("professionalProfileId", profile.id).in("status", Object.keys(STATUS)).order("startsAt", { ascending: false }) : { data: [] };
  type Row = { startsAt: string; durationMinutes: number; status: string; totalCents: number; feeCents: number; payment: { status: string } | { status: string }[] | null };
  const PAYMENT: Record<string, string> = { PENDING: "Aguardando", PAID_HELD: "Pago, retido", HELD: "Retido", APPROVED: "Aprovado", RELEASED: "Repassado", REFUNDED: "Reembolsado" };
  const rows = ((bookings ?? []) as Row[]).map((row) => {
    const payment = Array.isArray(row.payment) ? row.payment[0] : row.payment;
    const cancelled = row.status === "CANCELLED";
    return { date: parseDbDate(row.startsAt), duration: row.durationMinutes, status: STATUS[row.status] ?? row.status, total: row.totalCents, fee: row.feeCents, net: cancelled ? 0 : row.totalCents - row.feeCents, payment: PAYMENT[payment?.status ?? ""] ?? payment?.status ?? "" };
  });
  const sum = (key: "total" | "fee" | "net") => rows.reduce((total, row) => total + row[key], 0);
  const buffer = await buildBrandedWorkbook({ title: "Seus ganhos", subtitle: user.name, sections: [{
    name: "Ganhos",
    columns: [
      { header: "Data da conversa", key: "date", type: "date" }, { header: "Duração (min)", key: "duration", type: "number", width: 14 },
      { header: "Situação", key: "status", width: 26 }, { header: "Pago pelo cliente", key: "total", type: "money", width: 18 },
      { header: "Taxa Insidely", key: "fee", type: "money" }, { header: "Seu valor", key: "net", type: "money" }, { header: "Pagamento", key: "payment", width: 18 },
    ],
    rows, totals: rows.length ? { date: "Total", total: sum("total"), fee: sum("fee"), net: sum("net") } : undefined,
    empty: "Nenhuma conversa ainda. Quando você tiver conversas, elas aparecem aqui.",
  }] });
  return xlsxResponse(buffer, "insidely-ganhos.xlsx");
}
