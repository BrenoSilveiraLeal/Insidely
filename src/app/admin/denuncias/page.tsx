import { Role } from "@/lib/domain";
import { resolveReportAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData, getReportPeople } from "@/lib/queries";
import { parseDbDate, reportStatusLabel, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Denúncias" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  const reports = data.reports.filter((report) => Boolean(report.targetUserId || report.bookingId));
  const people = await getReportPeople(reports);
  return <DashboardShell mode="admin" title="Denúncias"><div className="list">{reports.map((report) => <div className="list-row" key={report.id}><div><strong>{report.category}</strong><p>{report.description}</p><small className="muted">Denunciante: {people.get(report.reporterId ?? "")?.name || "Conta removida"} · Perfil denunciado: {people.get(report.targetUserId ?? "")?.name || "—"} · {shortDate(parseDbDate(report.createdAt))}</small><br /><span className="status">{reportStatusLabel(report.status)}</span></div>{report.status !== "RESOLVED" && <form action={resolveReportAction.bind(null, report.id)}><button className="button button-dark button-sm">Resolver</button></form>}</div>)}{!reports.length && <div className="panel"><h2>Fila vazia</h2><p className="muted">Não há denúncias abertas.</p></div>}</div></DashboardShell>;
}
