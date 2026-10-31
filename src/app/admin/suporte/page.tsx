import { Role } from "@/lib/domain";
import { CaseOpenButton } from "@/components/case-open-button";
import { getReportCaseOwners } from "@/lib/support-threads";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData, getReportPeople } from "@/lib/queries";
import { parseDbDate, reportStatusLabel, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PaginationControls } from "@/components/pagination-controls";

const PAGE_SIZE = 20;

export const metadata = { title: "Chamados de suporte" };
export const dynamic = "force-dynamic";

// Newest first, a page at a time; names and owners are read only for the page shown.
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireUser([Role.ADMIN]);
  const [data, params] = await Promise.all([getAdminData(), searchParams]);
  const all = [...data.supportReports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Math.min(Math.max(1, Number(params.page) || 1), Math.max(1, Math.ceil(all.length / PAGE_SIZE)));
  const reports = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const [people, owners] = await Promise.all([getReportPeople(reports), getReportCaseOwners(reports.map((report) => report.id), admin.id)]);
  return <DashboardShell mode="admin" title="Chamados de suporte"><div className="list">{reports.map((report) => <div className="list-row" key={report.id}><div><strong>{report.category}</strong><p>{report.description}</p><small className="muted">Solicitante: {people.get(report.reporterId ?? "")?.name || "Conta removida"}{people.get(report.reporterId ?? "")?.email ? ` (${people.get(report.reporterId ?? "")?.email})` : ""} · {shortDate(parseDbDate(report.createdAt))}</small><br /><span className="status">{reportStatusLabel(report.status)}</span></div><CaseOpenButton reportId={report.id} open={report.status === "OPEN" || report.status === "IN_REVIEW"} owner={owners.get(report.id) ?? null}/></div>)}{!reports.length && <div className="panel"><h2>Fila vazia</h2><p className="muted">Não há solicitações de suporte abertas.</p></div>}</div><PaginationControls page={page} total={all.length} pageSize={PAGE_SIZE} basePath="/admin/suporte"/></DashboardShell>;
}
