import { Role } from "@/lib/domain";
import { resolveReportAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  return <DashboardShell mode="admin" title="Suporte"><div className="list">{data.supportReports.map((report) => <div className="list-row" key={report.id}><div><strong>{report.category}</strong><p>{report.description}</p><small className="muted">Solicitante: {report.reporterId} · {new Date(report.createdAt).toLocaleString("pt-BR")}</small><br /><span className="status">{report.status}</span></div>{report.status !== "RESOLVED" && <form action={resolveReportAction.bind(null, report.id)}><button className="button button-dark button-sm">Marcar resolvido</button></form>}</div>)}{!data.supportReports.length && <div className="panel"><h2>Fila vazia</h2><p className="muted">Não há solicitações de suporte abertas.</p></div>}</div></DashboardShell>;
}
