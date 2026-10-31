import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { describeAdminLog } from "@/lib/admin-log-text";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { PaginationControls } from "@/components/pagination-controls";

const PAGE_SIZE = 50;

export const metadata = { title: "Registro de ações" };
export const dynamic = "force-dynamic";


// Who did what in the admin panel, most recent first, 50 per page.
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser([Role.ADMIN]);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data, count } = await supabase.from("AdminActionLog").select("id, adminUserId, action, targetUserId, detail, createdAt", { count: "exact" }).order("createdAt", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as { id: string; adminUserId: string | null; action: string; targetUserId: string | null; detail: string | null; createdAt: string }[];
  const ids = [...new Set(rows.flatMap((row) => [row.adminUserId, row.targetUserId]).filter((id): id is string => Boolean(id)))];
  const { data: users } = ids.length ? await supabase.from("User").select("id, name").in("id", ids) : { data: [] };
  const texts = await describeAdminLog(rows);
  const name = (id: string | null) => ((users ?? []) as { id: string; name: string }[]).find((user) => user.id === id)?.name ?? "—";
  return <DashboardShell mode="admin" title="Registro de ações">
    <div className="table-wrap"><table><thead><tr><th>Quando</th><th>Admin</th><th>Ação</th><th>Conta</th><th>Detalhe</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{shortDate(parseDbDate(row.createdAt))}</td><td>{name(row.adminUserId)}</td><td>{texts[index].label}</td><td>{row.targetUserId ? <Link className="text-link" href={`/admin/usuarios/${row.targetUserId}`}>{name(row.targetUserId)}</Link> : "—"}</td><td className="muted">{texts[index].href && texts[index].detail ? <Link className="text-link" href={texts[index].href!}>{texts[index].detail}</Link> : texts[index].detail}</td></tr>)}</tbody></table>{!rows.length && <p className="muted">Nenhuma ação registrada ainda.</p>}</div>
    <PaginationControls page={page} total={count ?? rows.length} pageSize={PAGE_SIZE} basePath="/admin/registro"/>
  </DashboardShell>;
}
