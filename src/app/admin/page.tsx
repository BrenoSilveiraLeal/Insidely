import Link from "next/link";
import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { money } from "@/lib/format";
import { getAdminData } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  const openReports = data.reports.filter((report) => report.status !== "RESOLVED").length;
  const openSupport = data.supportReports.filter((report) => report.status !== "RESOLVED").length;
  return <DashboardShell mode="admin" title="Operação"><div className="grid grid-4"><div className="metric"><span>Usuários</span><strong>{data.users}</strong></div><div className="metric"><span>Profissionais</span><strong>{data.professionals}</strong></div><div className="metric"><span>Consultas</span><strong>{data.bookings}</strong></div><div className="metric"><span>Volume aprovado</span><strong>{money(data.revenueCents)}</strong></div></div><section className="section" style={{ paddingBottom: 0 }}><div className="grid grid-2"><Link className="panel admin-queue-link" href="/admin/verificacoes"><span className="eyebrow">Fila de verificações</span><h2>{data.pending.length} pendentes</h2><span className="muted">Abrir fila</span></Link><div className="panel"><span className="eyebrow">Pendências operacionais</span><h2>{openReports + openSupport} abertas</h2><div className="admin-queue-actions"><Link className="button button-ghost button-sm" href="/admin/denuncias">Denúncias ({openReports})</Link><Link className="button button-ghost button-sm" href="/admin/suporte">Suporte ({openSupport})</Link></div></div></div></section></DashboardShell>;
}
