import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { describeAdminLog } from "@/lib/admin-log-text";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Registro de ações" };
export const dynamic = "force-dynamic";


// Who did what in the admin panel, most recent first.
export default async function Page() {
  await requireUser([Role.ADMIN]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data } = await supabase.from("AdminActionLog").select("id, adminUserId, action, targetUserId, detail, createdAt").order("createdAt", { ascending: false }).limit(200);
  const rows = (data ?? []) as { id: string; adminUserId: string | null; action: string; targetUserId: string | null; detail: string | null; createdAt: string }[];
  const ids = [...new Set(rows.flatMap((row) => [row.adminUserId, row.targetUserId]).filter((id): id is string => Boolean(id)))];
  const { data: users } = ids.length ? await supabase.from("User").select("id, name").in("id", ids) : { data: [] };
  const texts = await describeAdminLog(rows);
  const name = (id: string | null) => ((users ?? []) as { id: string; name: string }[]).find((user) => user.id === id)?.name ?? "—";
  return <DashboardShell mode="admin" title="Registro de ações">
    <div className="table-wrap"><table><thead><tr><th>Quando</th><th>Admin</th><th>Ação</th><th>Conta</th><th>Detalhe</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{shortDate(parseDbDate(row.createdAt))}</td><td>{name(row.adminUserId)}</td><td>{texts[index].label}</td><td>{row.targetUserId ? <Link className="text-link" href={`/admin/usuarios/${row.targetUserId}`}>{name(row.targetUserId)}</Link> : "—"}</td><td className="muted">{texts[index].href && texts[index].detail ? <Link className="text-link" href={texts[index].href!}>{texts[index].detail}</Link> : texts[index].detail}</td></tr>)}</tbody></table>{!rows.length && <p className="muted">Nenhuma ação registrada ainda.</p>}</div>
  </DashboardShell>;
}
