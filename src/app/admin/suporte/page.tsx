import { Role } from "@/lib/domain";
import { CaseOpenButton } from "@/components/case-open-button";
import { getReportCaseOwners } from "@/lib/support-threads";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData, getReportPeople } from "@/lib/queries";
import { parseDbDate, reportStatusLabel, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Chamados de suporte" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const admin = await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  const [people, owners] = await Promise.all([getReportPeople(data.supportReports), getReportCaseOwners(data.supportReports.map((report) => report.id), admin.id)]);
  return <DashboardShell mode="admin" title="Chamados de suporte"><div className="list">{data.supportReports.map((report) => <div className="list-row" key={report.id}><div><strong>{report.category}</strong><p>{report.description}</p><small className="muted">Solicitante: {people.get(report.reporterId ?? "")?.name || "Conta removida"}{people.get(report.reporterId ?? "")?.email ? ` (${people.get(report.reporterId ?? "")?.email})` : ""} · {shortDate(parseDbDate(report.createdAt))}</small><br /><span className="status">{reportStatusLabel(report.status)}</span></div><CaseOpenButton reportId={report.id} open={report.status === "OPEN" || report.status === "IN_REVIEW"} owner={owners.get(report.id) ?? null}/></div>)}{!data.supportReports.length && <div className="panel"><h2>Fila vazia</h2><p className="muted">Não há solicitações de suporte abertas.</p></div>}</div></DashboardShell>;
}
