import { Role } from "@/lib/domain";
import { resolveReviewReportAction } from "@/app/actions";
import { CaseOpenButton } from "@/components/case-open-button";
import { getReportCaseOwners } from "@/lib/support-threads";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData, getReportPeople } from "@/lib/queries";
import { parseDbDate, reportStatusLabel, shortDate, visibleEmail } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getAttendanceSummaries } from "@/lib/attendance";
import { PaginationControls } from "@/components/pagination-controls";

export const metadata = { title: "Denúncias" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// Reports newest first, a page at a time; names, owners and attendance are read only for that page.
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireUser([Role.ADMIN]);
  const [data, params] = await Promise.all([getAdminData(), searchParams]);
  const all = data.reports.filter((report) => Boolean(report.targetUserId || report.bookingId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Math.min(Math.max(1, Number(params.page) || 1), Math.max(1, Math.ceil(all.length / PAGE_SIZE)));
  const reports = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const [people, owners] = await Promise.all([getReportPeople(reports), getReportCaseOwners(reports.map((report) => report.id), admin.id)]);
  const moderation = await getRecentModeration();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reviewReports } = await (createSupabaseServiceClient() as any).from("ReviewReport").select("id, reason, reviewComment, reviewRating, professionalProfileId, createdAt").eq("status", "OPEN").order("createdAt", { ascending: false }).limit(50);
  const attendance = await getAttendanceSummaries(createSupabaseServiceClient(), reports.map((report) => report.bookingId).filter((id): id is string => Boolean(id)));
  return <DashboardShell mode="admin" title="Denúncias"><div className="list">{reports.map((report) => <div className="list-row" key={report.id}><div><strong>{report.category}</strong><p>{report.description}</p><small className="muted">Denunciante: {people.get(report.reporterId ?? "")?.name || "Conta removida"} · Denunciado: {report.targetUserId ? <a className="text-link" href={`/admin/usuarios/${report.targetUserId}`}>{people.get(report.targetUserId)?.name || "ver conta"}</a> : "—"} · {shortDate(parseDbDate(report.createdAt))}</small><br />{report.bookingId && attendance.get(report.bookingId) && <><small className="muted">{attendance.get(report.bookingId)}</small><br /></>}<span className="status">{reportStatusLabel(report.status)}</span></div><div className="case-open-cell"><CaseOpenButton reportId={report.id} open={report.status === "OPEN" || report.status === "IN_REVIEW"} owner={owners.get(report.id) ?? null}/></div></div>)}{!reports.length && <div className="panel"><h2>Fila vazia</h2><p className="muted">Não há denúncias abertas.</p></div>}</div>
    <PaginationControls page={page} total={all.length} pageSize={PAGE_SIZE} basePath="/admin/denuncias"/>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Avaliações denunciadas</span><h2>Comentários publicados nos perfis</h2><div className="list">{(reviewReports ?? []).map((item: { id: string; reason: string; reviewComment: string | null; reviewRating: number | null; professionalProfileId: string | null; createdAt: string }) => <div className="list-row" key={item.id}><div><strong>★ {item.reviewRating ?? "–"} · “{item.reviewComment || "sem comentário"}”</strong><p className="muted">Motivo da denúncia: {item.reason}</p><small className="muted">{shortDate(parseDbDate(item.createdAt))}{item.professionalProfileId && <> · <a className="text-link" href={`/profissional/${item.professionalProfileId}`} target="_blank" rel="noreferrer">ver perfil</a></>}</small></div><div className="verification-row-actions"><form action={resolveReviewReportAction.bind(null, item.id, "REMOVED")}><button className="button button-danger button-sm">Remover avaliação</button></form><form action={resolveReviewReportAction.bind(null, item.id, "KEPT")}><button className="button button-ghost button-sm">Manter</button></form></div></div>)}{!reviewReports?.length && <div className="panel muted">Nenhuma avaliação denunciada.</div>}</div></section>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Chat · últimos 30 dias</span><h2>Mensagens bloqueadas pela moderação</h2><p className="muted">Tentativas de passar contato, combinar pagamento por fora ou usar linguagem ofensiva. Contas com várias tentativas merecem análise.</p><div className="list">{moderation.map((item) => <div className="list-row" key={item.userId}><div><strong><a className="text-link" href={`/admin/usuarios/${item.userId}`}>{item.name}</a></strong><p className="muted">{item.contact} de contato/pagamento por fora · {item.offensive} ofensivas · última em {shortDate(parseDbDate(item.lastAt))}</p><small className="muted">“{item.lastExcerpt}”</small></div><span className="status">{item.contact + item.offensive} tentativas</span></div>)}{!moderation.length && <div className="panel muted">Nenhuma mensagem bloqueada no período.</div>}</div></section>
  </DashboardShell>;
}

async function getRecentModeration() {
  // ChatModerationEvent is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: events, error } = await supabase.from("ChatModerationEvent").select("userId, reason, excerpt, createdAt")
    .gte("createdAt", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()).order("createdAt", { ascending: false }).limit(500);
  if (error || !events?.length) return [];
  const byUser = new Map<string, { userId: string; name: string; contact: number; offensive: number; lastAt: string; lastExcerpt: string }>();
  for (const event of events as { userId: string; reason: string; excerpt: string; createdAt: string }[]) {
    const entry = byUser.get(event.userId) ?? { userId: event.userId, name: "", contact: 0, offensive: 0, lastAt: event.createdAt, lastExcerpt: event.excerpt.slice(0, 160) };
    if (event.reason === "offensive") entry.offensive++; else entry.contact++;
    byUser.set(event.userId, entry);
  }
  const { data: users } = await supabase.from("User").select("id, name, email").in("id", [...byUser.keys()]);
  for (const user of users ?? []) { const entry = byUser.get(user.id); if (entry) entry.name = visibleEmail(user.email) ? `${user.name} (${user.email})` : `${user.name} (conta excluída)`; }
  return [...byUser.values()].sort((a, b) => (b.contact + b.offensive) - (a.contact + a.offensive)).slice(0, 50);
}
