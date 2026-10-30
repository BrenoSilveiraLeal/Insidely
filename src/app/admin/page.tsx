import { getAdminMetrics } from "@/lib/admin-metrics";
import { BarChart } from "@/components/bar-chart";
import Link from "next/link";
import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { money } from "@/lib/format";
import { getAdminData } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Administração" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  const openReports = data.reports.filter((report) => report.status !== "RESOLVED").length;
  const openSupport = data.supportReports.filter((report) => report.status !== "RESOLVED").length;
  const metrics = await getAdminMetrics();
  return <DashboardShell mode="admin" title="Operação"><section className="admin-indicators"><span className="eyebrow">Indicadores</span><div className="grid grid-4"><div className="metric"><span>Comparecimento (30 dias)</span><strong>{metrics.attendance === null ? "—" : `${metrics.attendance}%`}</strong><small className="muted">{metrics.noShows} falta(s) de um dos lados</small></div><div className="metric"><span>A conversa ajudou</span><strong>{metrics.helped === null ? "—" : `${metrics.helped}%`}</strong><small className="muted">{metrics.partly === null ? "sem respostas ainda" : `+${metrics.partly}% “em parte” · ${metrics.surveyAnswers} respostas`}</small></div><div className="metric"><span>Nota média dos consultores</span><strong>{metrics.rating === null ? "—" : `★ ${metrics.rating.toFixed(1)}`}</strong></div><div className="metric"><span>Mensagens bloqueadas (30 dias)</span><strong>{metrics.blockedMessages}</strong></div></div><div className="grid grid-2 admin-charts"><BarChart title="Conversas pagas por mês" unit="conversas" data={metrics.conversations}/><BarChart title="Denúncias por mês" unit="denúncias" data={metrics.reports}/></div><p className="muted">Taxa da plataforma nos últimos 30 dias: {money(metrics.revenue)} (simulada).</p></section><div className="grid grid-4"><div className="metric"><span>Usuários</span><strong>{data.users}</strong></div><div className="metric"><span>Profissionais</span><strong>{data.professionals}</strong></div><div className="metric"><span>Consultas</span><strong>{data.bookings}</strong></div><div className="metric"><span>Volume bruto</span><strong>{money(data.grossVolumeCents)}</strong></div><div className="metric"><span>Receita da plataforma</span><strong>{money(data.platformRevenueCents)}</strong></div></div><section className="section" style={{ paddingBottom: 0 }}><div className="grid grid-2"><Link className="panel admin-queue-link" href="/admin/verificacoes"><span className="eyebrow">Fila de verificações</span><h2>{data.pending.length} pendentes</h2><span className="muted">Abrir fila</span></Link><div className="panel"><span className="eyebrow">Pendências operacionais</span><h2>{openReports + openSupport} abertas</h2><div className="admin-queue-actions"><Link className="button button-ghost button-sm" href="/admin/denuncias">Denúncias ({openReports})</Link><Link className="button button-ghost button-sm" href="/admin/suporte">Suporte ({openSupport})</Link></div></div></div></section></DashboardShell>;
}
