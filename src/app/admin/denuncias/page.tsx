import { Role } from "@/lib/domain";
import { resolveReportAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  const reports = data.reports.filter((report) => Boolean(report.targetUserId || report.bookingId));
  return <DashboardShell mode="admin" title="Denúncias"><div className="list">{reports.map((report) => <div className="list-row" key={report.id}><div><strong>{report.category}</strong><p>{report.description}</p><span className="status">{report.status}</span></div>{report.status !== "RESOLVED" && <form action={resolveReportAction.bind(null, report.id)}><button className="button button-dark button-sm">Resolver</button></form>}</div>)}{!reports.length && <div className="panel"><h2>Fila vazia</h2><p className="muted">Não há denúncias abertas.</p></div>}</div></DashboardShell>;
}
