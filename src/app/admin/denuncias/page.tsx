import { Role } from "@/lib/domain";
import { resolveReportAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData, getReportPeople } from "@/lib/queries";
import { parseDbDate, reportStatusLabel, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Denúncias" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  const reports = data.reports.filter((report) => Boolean(report.targetUserId || report.bookingId));
  const people = await getReportPeople(reports);
  const moderation = await getRecentModeration();
  return <DashboardShell mode="admin" title="Denúncias"><div className="list">{reports.map((report) => <div className="list-row" key={report.id}><div><strong>{report.category}</strong><p>{report.description}</p><small className="muted">Denunciante: {people.get(report.reporterId ?? "")?.name || "Conta removida"} · Perfil denunciado: {people.get(report.targetUserId ?? "")?.name || "—"} · {shortDate(parseDbDate(report.createdAt))}</small><br /><span className="status">{reportStatusLabel(report.status)}</span></div>{report.status !== "RESOLVED" && <form action={resolveReportAction.bind(null, report.id)}><button className="button button-dark button-sm">Resolver</button></form>}</div>)}{!reports.length && <div className="panel"><h2>Fila vazia</h2><p className="muted">Não há denúncias abertas.</p></div>}</div>
    <section className="section" style={{ paddingBottom: 0 }}><span className="eyebrow">Chat · últimos 30 dias</span><h2>Mensagens bloqueadas pela moderação</h2><p className="muted">Tentativas de passar contato, combinar pagamento por fora ou usar linguagem ofensiva. Contas com várias tentativas merecem análise.</p><div className="list">{moderation.map((item) => <div className="list-row" key={item.userId}><div><strong>{item.name}</strong><p className="muted">{item.contact} de contato/pagamento por fora · {item.offensive} ofensivas · última em {shortDate(parseDbDate(item.lastAt))}</p><small className="muted">“{item.lastExcerpt}”</small></div><span className="status">{item.contact + item.offensive} tentativas</span></div>)}{!moderation.length && <div className="panel muted">Nenhuma mensagem bloqueada no período.</div>}</div></section>
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
  for (const user of users ?? []) { const entry = byUser.get(user.id); if (entry) entry.name = `${user.name} (${user.email})`; }
  return [...byUser.values()].sort((a, b) => (b.contact + b.offensive) - (a.contact + a.offensive)).slice(0, 50);
}
