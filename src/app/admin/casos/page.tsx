import Link from "next/link";
import { assignCaseAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { FlashMessage } from "@/components/flash-message";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Casos" };
export const dynamic = "force-dynamic";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

type Case = { key: string; kind: string; waiting?: string; title: string; detail: string; createdAt: string; href: string };
type ClosedCase = { key: string; kind: string; outcome: string; title: string; detail: string; closedAt: string; href: string };
const REVIEW_OUTCOME: Record<string, string> = { REMOVED: "Avaliação removida", KEPT: "Avaliação mantida" };
const NOBODY = "ninguem";

// One queue for everything that needs a person: open reports, reported reviews, disputes and
// one-sided attendance (no-shows) of the last 14 days. Each case can be taken by an admin.
// Filters: ?quem= (eu, an admin id or "ninguem") and ?estado=encerrados for the closed cases, which are
// found through their CaseAssignment row (it stays after the case is closed). Support staff see only
// support requests and reports (the other kinds are handled on admin-only pages).
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; quem?: string; estado?: string }> }) {
  const { ok, erro, quem, estado } = await searchParams;
  const admin = await requireUser([Role.ADMIN, Role.SUPPORT]);
  const isAdmin = admin.role === Role.ADMIN;
  const none = { data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const since = daysAgo(14);
  const [{ data: reports }, { data: reviewReports }, { data: disputes }, { data: checked }, { data: assignments }] = await Promise.all([
    supabase.from("Report").select("id, category, description, targetUserId, bookingId, status, createdAt").in("status", ["OPEN", "IN_REVIEW"]).order("createdAt"),
    isAdmin ? supabase.from("ReviewReport").select("id, reason, reviewComment, createdAt").eq("status", "OPEN").order("createdAt") : none,
    isAdmin ? supabase.from("Booking").select("id, customerId, disputedAt, updatedAt").eq("status", "DISPUTED").order("updatedAt") : none,
    !isAdmin ? none : supabase.from("Booking").select("id, customerId, startsAt, professionalProfile:ProfessionalProfile(userId)").not("noShowCheckedAt", "is", null).gte("startsAt", since).in("status", ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"]),
    supabase.from("CaseAssignment").select("caseKey, adminUserId, admin:User(name)"),
  ]);
  const { data: adminRows } = await supabase.from("User").select("id, name").in("role", ["ADMIN", "SUPPORT"]).not("auth_user_id", "is", null).order("name");
  const cases: Case[] = [
    ...((reports ?? []) as { id: string; category: string; description: string; targetUserId: string | null; bookingId: string | null; status: string; createdAt: string }[]).map((item) => ({ key: `report:${item.id}`, kind: item.targetUserId || item.bookingId ? "Denúncia" : "Suporte", waiting: item.status === "IN_REVIEW" ? "Aguardando a pessoa" : undefined, title: item.category, detail: item.description, createdAt: item.createdAt, href: `/admin/casos/relato/${item.id}` })),
    ...((reviewReports ?? []) as { id: string; reason: string; reviewComment: string | null; createdAt: string }[]).map((item) => ({ key: `review:${item.id}`, kind: "Avaliação denunciada", title: `“${item.reviewComment ?? "sem comentário"}”`, detail: item.reason, createdAt: item.createdAt, href: "/admin/denuncias" })),
    ...((disputes ?? []) as { id: string; customerId: string; disputedAt: string | null; updatedAt: string }[]).map((item) => ({ key: `dispute:${item.id}`, kind: "Contestação", title: `Conversa ${item.id.slice(0, 8)}`, detail: "Pagamento retido até a decisão do suporte.", createdAt: item.disputedAt ?? item.updatedAt, href: `/admin/usuarios/${item.customerId}` })),
  ];
  const checkedRows = (checked ?? []) as { id: string; customerId: string; startsAt: string; professionalProfile: { userId: string } | { userId: string }[] | null }[];
  if (checkedRows.length) {
    const { data: entries } = await supabase.from("RoomAttendance").select("bookingId, userId").in("bookingId", checkedRows.map((row) => row.id));
    for (const row of checkedRows) {
      const consultantId = (Array.isArray(row.professionalProfile) ? row.professionalProfile[0] : row.professionalProfile)?.userId;
      const entered = new Set(((entries ?? []) as { bookingId: string; userId: string }[]).filter((entry) => entry.bookingId === row.id).map((entry) => entry.userId));
      const customerIn = entered.has(row.customerId), consultantIn = consultantId ? entered.has(consultantId) : false;
      if (customerIn !== consultantIn && consultantId !== row.customerId) cases.push({ key: `noshow:${row.id}`, kind: "Falta", title: customerIn ? "Consultor não entrou na sala" : "Cliente não entrou na sala", detail: `Conversa de ${shortDate(parseDbDate(row.startsAt))}.`, createdAt: row.startsAt, href: `/admin/usuarios/${customerIn ? consultantId : row.customerId}` });
    }
  }
  cases.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const owner = new Map(((assignments ?? []) as { caseKey: string; adminUserId: string; admin: { name: string } | { name: string }[] | null }[]).map((row) => [row.caseKey, { id: row.adminUserId, name: (Array.isArray(row.admin) ? row.admin[0]?.name : row.admin?.name) ?? "Admin" }]));
  const admins = ((adminRows ?? []) as { id: string; name: string | null }[]).filter((row) => row.id !== admin.id);
  const who = quem === "eu" ? admin.id : quem || null;
  const showClosed = estado === "encerrados";
  const matches = (key: string) => !who || (who === NOBODY ? !owner.get(key) : owner.get(key)?.id === who);
  const open = cases.filter((item) => matches(item.key));

  // Closed cases always had someone responsible, so "Sem responsável" has none.
  const openKeys = new Set(cases.map((item) => item.key));
  const closedKeys = [...owner.keys()].filter((key) => !openKeys.has(key) && who !== NOBODY && matches(key) && (isAdmin || key.startsWith("report:")));
  const ids = (prefix: string) => closedKeys.filter((key) => key.startsWith(`${prefix}:`)).map((key) => key.slice(prefix.length + 1));
  const reportIds = ids("report"), reviewIds = ids("review"), disputeIds = new Set(ids("dispute")), bookingIds = [...disputeIds, ...ids("noshow")];
  const [{ data: oldReports }, { data: oldReviews }, { data: oldBookings }] = await Promise.all([
    reportIds.length ? supabase.from("Report").select("id, category, description, targetUserId, bookingId, status, updatedAt").in("id", reportIds).in("status", ["RESOLVED", "DISMISSED"]) : { data: [] },
    reviewIds.length ? supabase.from("ReviewReport").select("id, reason, reviewComment, status, resolvedAt, createdAt").in("id", reviewIds).neq("status", "OPEN") : { data: [] },
    bookingIds.length ? supabase.from("Booking").select("id, customerId, startsAt, updatedAt").in("id", bookingIds) : { data: [] },
  ]);
  const closed: ClosedCase[] = [];
  for (const item of (oldReports ?? []) as { id: string; category: string; description: string; targetUserId: string | null; bookingId: string | null; status: string; updatedAt: string }[]) closed.push({ key: `report:${item.id}`, kind: item.targetUserId || item.bookingId ? "Denúncia" : "Suporte", outcome: item.status === "RESOLVED" ? "Resolvido" : "Arquivado", title: item.category, detail: item.description, closedAt: item.updatedAt, href: `/admin/casos/relato/${item.id}` });
  for (const item of (oldReviews ?? []) as { id: string; reason: string; reviewComment: string | null; status: string; resolvedAt: string | null; createdAt: string }[]) closed.push({ key: `review:${item.id}`, kind: "Avaliação denunciada", outcome: REVIEW_OUTCOME[item.status] ?? "Encerrado", title: `“${item.reviewComment ?? "sem comentário"}”`, detail: item.reason, closedAt: item.resolvedAt ?? item.createdAt, href: "/admin/denuncias" });
  for (const item of (oldBookings ?? []) as { id: string; customerId: string; startsAt: string; updatedAt: string }[]) {
    const dispute = disputeIds.has(item.id);
    closed.push({ key: `${dispute ? "dispute" : "noshow"}:${item.id}`, kind: dispute ? "Contestação" : "Falta", outcome: dispute ? "Decidida" : "Encerrada", title: `Conversa de ${shortDate(parseDbDate(item.startsAt))}`, detail: dispute ? "Contestação já decidida." : "Falta já tratada.", closedAt: item.updatedAt, href: `/admin/usuarios/${item.customerId}` });
  }
  closed.sort((a, b) => b.closedAt.localeCompare(a.closedAt));

  const link = (next: { quem?: string | null; estado?: string | null }) => {
    const params = new URLSearchParams();
    const q = next.quem === undefined ? quem : next.quem, e = next.estado === undefined ? estado : next.estado;
    if (q) params.set("quem", q);
    if (e === "encerrados") params.set("estado", e);
    return `/admin/casos${params.size ? `?${params}` : ""}`;
  };
  const people = [{ value: null, label: "Todos" }, { value: "eu", label: "Você" }, ...(isAdmin ? admins.map((row) => ({ value: row.id, label: row.name ?? "Admin" })) : []), { value: NOBODY, label: "Sem responsável" }];
  const ownerLabel = (key: string) => { const taken = owner.get(key); return taken ? (taken.id === admin.id ? "você" : taken.name) : null; };
  return <DashboardShell mode={isAdmin ? "admin" : "support"} title="Casos">
    {erro === "assumir" && <FlashMessage param="erro">Esse caso ainda não tem responsável. Use “Assumir e abrir” para abri-lo.</FlashMessage>}
    {ok && <FlashMessage key={ok}>{ok === "arquivado" ? "Caso arquivado. A resposta foi enviada para quem abriu." : "Caso resolvido. A resposta foi enviada para quem abriu."}</FlashMessage>}
    <nav className="case-filter" aria-label="Responsável">{people.map((person) => { const active = (quem || null) === person.value; return <Link key={person.value ?? "todos"} className={`button button-sm ${active ? "button-dark" : "button-ghost"}`} href={link({ quem: person.value })} aria-current={active ? "page" : undefined}>{person.label}</Link>; })}</nav>
    <nav className="catalog-counters catalog-tabs" aria-label="Estado dos casos">
      <Link className={`metric catalog-tab${showClosed ? "" : " is-active"}`} href={link({ estado: null })} aria-current={showClosed ? undefined : "page"}><span>Abertos</span><strong>{open.length}</strong></Link>
      <Link className={`metric catalog-tab${showClosed ? " is-active" : ""}`} href={link({ estado: "encerrados" })} aria-current={showClosed ? "page" : undefined}><span>Encerrados</span><strong>{closed.length}</strong></Link>
    </nav>
    {showClosed ? <div className="list">{closed.map((item) => <div className="list-row case-row" key={item.key}>
      <div><span className="status">{item.kind}</span> <span className="support-case-state is-closed">{item.outcome}</span> <strong>{item.title}</strong><p className="muted">{item.detail}</p><small className="muted">Encerrado em {shortDate(parseDbDate(item.closedAt))} · <strong className={`case-owner${owner.get(item.key)?.id === admin.id ? " is-me" : ""}`}>Responsável: {ownerLabel(item.key)}</strong></small></div>
      <div className="verification-row-actions"><Link className="button button-ghost button-sm" href={item.href}>Ver</Link></div>
    </div>)}{!closed.length && <section className="panel catalog-empty"><span className="catalog-empty-icon" aria-hidden="true">✓</span><h2>Nenhum caso encerrado</h2><p className="muted">{who === NOBODY ? "Todo caso encerrado teve um responsável." : "Os casos encerrados aparecem aqui, do mais recente para o mais antigo."}</p></section>}</div> : <>
    <p className="muted">{open.length} {open.length === 1 ? "caso aberto" : "casos abertos"}, do mais antigo para o mais recente. Para abrir um caso, alguém precisa assumi-lo: o responsável fica registrado e é quem responde.</p>
    <div className="list">{open.map((item) => { const taken = owner.get(item.key); return <div className="list-row case-row" key={item.key}>
      <div><span className="status">{item.kind}</span> {item.waiting && <span className="support-case-state is-answered">{item.waiting}</span>} <strong>{item.title}</strong><p className="muted">{item.detail}</p><small className="muted">Aberto em {shortDate(parseDbDate(item.createdAt))} · {taken ? <strong className={`case-owner${taken.id === admin.id ? " is-me" : ""}`}>Responsável: {taken.id === admin.id ? "você" : taken.name}</strong> : "Ninguém assumiu ainda"}</small></div>
      <div className="verification-row-actions">{taken ? <><Link className="button button-dark button-sm" href={item.href}>Abrir</Link>{taken.id !== admin.id && isAdmin && <form action={assignCaseAction.bind(null, item.key, undefined)}><button className="button button-ghost button-sm">Assumir no lugar</button></form>}</> : <form action={assignCaseAction.bind(null, item.key, item.href)}><button className="button button-dark button-sm">Assumir e abrir</button></form>}</div>

    </div>; })}{!open.length && <section className="panel catalog-empty"><span className="catalog-empty-icon" aria-hidden="true">✓</span><h2>Nenhum caso aberto</h2><p className="muted">{who ? "Nenhum caso aberto com este filtro." : "Denúncias, avaliações denunciadas, contestações e faltas aparecem aqui assim que surgirem, e chegam também no sino."}</p></section>}</div>
    </>}
  </DashboardShell>;
}
