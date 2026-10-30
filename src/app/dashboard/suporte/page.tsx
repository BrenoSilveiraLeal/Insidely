import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getMySupportCases, OPEN_REPORT_STATUSES, personCaseStatus } from "@/lib/support-threads";

export const metadata = { title: "Suporte" };
export const dynamic = "force-dynamic";

// The person's support requests and reports, each one a conversation with the team.
export default async function Page() {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const cases = await getMySupportCases(user.id);
  return <DashboardShell mode={user.role === Role.CONSULTANT ? "consultant" : "user"} title="Suporte" canConsultant={user.role === Role.CONSULTANT}>
    <div className="support-cases-head"><p className="muted">Seus pedidos de ajuda e denúncias. Cada caso guarda a conversa com a equipe até ser resolvido.</p><Link className="button button-dark button-sm" href="/suporte">Novo pedido de ajuda</Link></div>
    <div className="list">{cases.map((item) => <Link className="list-row support-case-row" href={`/dashboard/suporte/${item.id}`} key={item.id}>
      <div><span className="status">{item.targetUserId || item.bookingId ? "Denúncia" : "Suporte"}</span> <strong>{item.category}</strong><p className="muted">{item.description.length > 140 ? `${item.description.slice(0, 140)}…` : item.description}</p><small className="muted">Aberto em {shortDate(parseDbDate(item.createdAt))} · última atividade {shortDate(parseDbDate(item.updatedAt))}</small></div>
      <span className={`support-case-state${item.status === "IN_REVIEW" ? " is-answered" : OPEN_REPORT_STATUSES.includes(item.status) ? "" : " is-closed"}`}>{personCaseStatus(item.status)}</span>
    </Link>)}{!cases.length && <section className="panel catalog-empty"><h2>Nenhum caso aberto</h2><p className="muted">Quando você pedir ajuda ou fizer uma denúncia, a conversa com a equipe aparece aqui.</p></section>}</div>
  </DashboardShell>;
}
