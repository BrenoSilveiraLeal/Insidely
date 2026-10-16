import { Role } from "@/lib/domain";
import { resolveReportAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData, getReportPeople } from "@/lib/queries";
import { parseDbDate, reportStatusLabel, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Chamados de suporte" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  const people = await getReportPeople(data.supportReports);
  return <DashboardShell mode="admin" title="Chamados de suporte"><div className="list">{data.supportReports.map((report) => <div className="list-row" key={report.id}><div><strong>{report.category}</strong><p>{report.description}</p><small className="muted">Solicitante: {people.get(report.reporterId ?? "")?.name || "Conta removida"}{people.get(report.reporterId ?? "")?.email ? ` (${people.get(report.reporterId ?? "")?.email})` : ""} · {shortDate(parseDbDate(report.createdAt))}</small><br /><span className="status">{reportStatusLabel(report.status)}</span></div>{report.status !== "RESOLVED" && <form action={resolveReportAction.bind(null, report.id)}><button className="button button-dark button-sm">Marcar resolvido</button></form>}</div>)}{!data.supportReports.length && <div className="panel"><h2>Fila vazia</h2><p className="muted">Não há solicitações de suporte abertas.</p></div>}</div></DashboardShell>;
}
