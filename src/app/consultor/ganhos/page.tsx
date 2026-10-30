import { DashboardShell } from "@/components/dashboard-shell";
import { PaginationControls } from "@/components/pagination-controls";
import { Role, PaymentStatus } from "@/lib/domain";
import { money, shortDate } from "@/lib/format";
import { getConsultantGains } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Ganhos" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { [PaymentStatus.RELEASED]: "Liberado", HELD: "Retido", PAID_HELD: "Retido", REFUNDED: "Reembolsado", TRANSFER_FAILED: "Repasse com falha" };

// Wallet: what was released, what is held until the conversation is confirmed, and what upcoming
// confirmed conversations will add.
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser([Role.CONSULTANT]);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const gains = await getConsultantGains(user.id, page, 20);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle();
  const { data: upcoming } = profile ? await supabase.from("Booking").select("totalCents, feeCents").eq("professionalProfileId", profile.id).eq("status", "CONFIRMED").gt("startsAt", new Date().toISOString()) : { data: [] };
  const upcomingCents = (upcoming ?? []).reduce((sum: number, row: { totalCents: number; feeCents: number }) => sum + row.totalCents - row.feeCents, 0);
  return <DashboardShell mode="consultant" title="Ganhos">
    <div className="grid grid-3 wallet-metrics">
      <div className="metric"><span>Liberado para você</span><strong>{money(gains.releasedTotalCents)}</strong></div>
      <div className="metric"><span>Retido até a confirmação</span><strong>{money(gains.heldTotalCents)}</strong></div>
      <div className="metric"><span>A receber (conversas futuras)</span><strong>{money(upcomingCents)}</strong></div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Seu valor</th><th>Situação</th></tr></thead><tbody>{gains.items.map((booking) => <tr key={booking.id}><td>{shortDate(booking.startsAt)}</td><td>{booking.customer.name}</td><td>{money(booking.totalCents - booking.feeCents)}</td><td><span className="status">{STATUS_LABEL[booking.payment?.status ?? ""] ?? "Retido"}</span></td></tr>)}</tbody></table>{!gains.items.length && <p className="muted">Nenhuma conversa paga ainda.</p>}</div>
    <PaginationControls page={gains.page} total={gains.total} pageSize={gains.pageSize} basePath="/consultor/ganhos"/>
  </DashboardShell>;
}
