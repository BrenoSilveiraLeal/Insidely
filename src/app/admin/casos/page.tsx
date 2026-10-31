import Form from "next/form";
import Link from "next/link";
import { assignCaseAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { FlashMessage } from "@/components/flash-message";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { PaginationControls } from "@/components/pagination-controls";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Casos" };
export const dynamic = "force-dynamic";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

type Case = { key: string; kind: string; waiting?: string; title: string; detail: string; createdAt: string; href: string };
type ClosedCase = { key: string; kind: string; outcome: string; title: string; detail: string; closedAt: string; href: string };
const REVIEW_OUTCOME: Record<string, string> = { REMOVED: "Avaliação removida", KEPT: "Avaliação mantida" };
const NOBODY = "ninguem";
const PAGE_SIZE = 20;

// One queue for everything that needs a person: open reports, reported reviews, disputes and
// one-sided attendance (no-shows) of the last 14 days. Each case can be taken by an admin.
// Filters: ?quem= (eu, a staff member's id or "ninguem"; repeatable) and ?estado=encerrados for the closed cases, which are
// found through their CaseAssignment row (it stays after the case is closed). Support staff see
// support requests, reports and contested conversations (the other kinds are on admin-only pages).
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; quem?: string | string[]; estado?: string; page?: string }> }) {
  const { ok, erro, quem, estado, page: pageParam } = await searchParams;
  const admin = await requireUser([Role.ADMIN, Role.SUPPORT]);
  const isAdmin = admin.role === Role.ADMIN;
  const none = { data: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const since = daysAgo(14);
  const [{ data: reports }, { data: reviewReports }, { data: disputes }, { data: checked }, { data: assignments }, { data: adminRows }] = await Promise.all([
    supabase.from("Report").select("id, category, description, targetUserId, bookingId, status, createdAt").in("status", ["OPEN", "IN_REVIEW"]).order("createdAt"),
    isAdmin ? supabase.from("ReviewReport").select("id, reason, reviewComment, createdAt").eq("status", "OPEN").order("createdAt") : none,
    supabase.from("Booking").select("id, customerId, disputedAt, updatedAt").eq("status", "DISPUTED").order("updatedAt"),
    !isAdmin ? none : supabase.from("Booking").select("id, customerId, startsAt, professionalProfile:ProfessionalProfile(userId)").not("noShowCheckedAt", "is", null).gte("startsAt", since).in("status", ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"]),
    supabase.from("CaseAssignment").select("caseKey, adminUserId, admin:User(name)"),
    supabase.from("User").select("id, name").in("role", ["ADMIN", "SUPPORT"]).not("auth_user_id", "is", null).order("name"),
  ]);
  const cases: Case[] = [
    ...((reports ?? []) as { id: string; category: string; description: string; targetUserId: string | null; bookingId: string | null; status: string; createdAt: string }[]).map((item) => ({ key: `report:${item.id}`, kind: item.targetUserId || item.bookingId ? "Denúncia" : "Suporte", waiting: item.status === "IN_REVIEW" ? "Aguardando a pessoa" : undefined, title: item.category, detail: item.description, createdAt: item.createdAt, href: `/admin/casos/relato/${item.id}` })),
    ...((reviewReports ?? []) as { id: string; reason: string; reviewComment: string | null; createdAt: string }[]).map((item) => ({ key: `review:${item.id}`, kind: "Avaliação denunciada", title: `“${item.reviewComment ?? "sem comentário"}”`, detail: item.reason, createdAt: item.createdAt, href: "/admin/denuncias" })),
    ...((disputes ?? []) as { id: string; customerId: string; disputedAt: string | null; updatedAt: string }[]).map((item) => ({ key: `dispute:${item.id}`, kind: "Contestação", title: `Conversa ${item.id.slice(0, 8)}`, detail: "Pagamento retido até a decisão do suporte.", createdAt: item.disputedAt ?? item.updatedAt, href: `/admin/casos/contestacao/${item.id}` })),
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
  // Several people can be ticked at once (?quem=eu&quem=<id>); none ticked shows everyone.
  const picked = (Array.isArray(quem) ? quem : quem ? [quem] : []).filter(Boolean);
  const who = new Set(picked.map((value) => value === "eu" ? admin.id : value));
  const showClosed = estado === "encerrados";
  const matches = (key: string) => { const taken = owner.get(key); return !who.size || (taken ? who.has(taken.id) : who.has(NOBODY)); };
  // Support staff see only cases nobody took yet (to take them) and their own; admins see all.
  const visibleToMe = (key: string) => { const taken = owner.get(key); return isAdmin || !taken || taken.id === admin.id; };
  const open = cases.filter((item) => visibleToMe(item.key) && matches(item.key));

  // Closed cases always had someone responsible, so "Sem responsável" alone finds none.
  const openKeys = new Set(cases.map((item) => item.key));
  const closedKeys = [...owner.keys()].filter((key) => !openKeys.has(key) && matches(key) && (isAdmin || ((key.startsWith("report:") || key.startsWith("dispute:")) && owner.get(key)?.id === admin.id)));
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
    closed.push({ key: `${dispute ? "dispute" : "noshow"}:${item.id}`, kind: dispute ? "Contestação" : "Falta", outcome: dispute ? "Decidida" : "Encerrada", title: `Conversa de ${shortDate(parseDbDate(item.startsAt))}`, detail: dispute ? "Contestação já decidida." : "Falta já tratada.", closedAt: item.updatedAt, href: dispute ? `/admin/casos/contestacao/${item.id}` : `/admin/usuarios/${item.customerId}` });
  }
  closed.sort((a, b) => b.closedAt.localeCompare(a.closedAt));

  const link = (next: { estado: string | null }) => {
    const params = new URLSearchParams();
    for (const value of picked) params.append("quem", value);
    if (next.estado === "encerrados") params.set("estado", next.estado);
    return `/admin/casos${params.size ? `?${params}` : ""}`;
  };
  const people = [{ value: "eu", label: "Você" }, ...(isAdmin ? admins.map((row) => ({ value: row.id, label: row.name ?? "Admin" })) : []), { value: NOBODY, label: "Sem responsável" }];
  // The visible list (open or closed) a page at a time; the counters keep the full totals.
  const listed = showClosed ? closed.length : open.length;
  const page = Math.min(Math.max(1, Number(pageParam) || 1), Math.max(1, Math.ceil(listed / PAGE_SIZE)));
  const pageOf = <T,>(items: T[]) => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pickedLabels = people.filter((person) => picked.includes(person.value)).map((person) => person.label);
  const ownerLabel = (key: string) => { const taken = owner.get(key); return taken ? (taken.id === admin.id ? "você" : taken.name) : null; };
  return <DashboardShell mode={isAdmin ? "admin" : "support"} title="Casos">
    {erro === "assumir" && <FlashMessage param="erro">Esse caso ainda não tem responsável. Use “Assumir e abrir” para abri-lo.</FlashMessage>}
    {ok && <FlashMessage key={ok}>{ok === "arquivado" ? "Caso arquivado. A resposta foi enviada para quem abriu." : ok === "devolvido" ? "Contestação decidida: o valor foi devolvido ao cliente." : ok === "parcial" ? "Contestação decidida: parte do valor foi devolvida ao cliente e o restante segue para o consultor." : ok === "liberado" ? "Contestação decidida: o valor segue para o consultor." : "Caso resolvido. A resposta foi enviada para quem abriu."}</FlashMessage>}
    <div className="case-queue">
    <div className="case-filter">
      {/* Keyed by the filter, so the menu closes after "Aplicar". next/form navigates without a full reload. */}
      <details className="case-filter-menu" key={picked.join(",")}>
        <summary className="button button-ghost button-sm">Filtrar casos{picked.length > 0 && <span className="case-filter-count">{picked.length}</span>}</summary>
        <Form className="case-filter-panel" action="/admin/casos">
          {showClosed && <input type="hidden" name="estado" value="encerrados"/>}
          <fieldset><legend>Responsável</legend>{people.map((person) => <label className="check-row" key={person.value}><input type="checkbox" name="quem" value={person.value} defaultChecked={picked.includes(person.value)}/><span>{person.label}</span></label>)}</fieldset>
          <div className="case-filter-actions"><Link className="button button-ghost button-sm" href={showClosed ? "/admin/casos?estado=encerrados" : "/admin/casos"}>Limpar</Link><button className="button button-dark button-sm">Aplicar</button></div>
        </Form>
      </details>
      <span className="muted">{pickedLabels.length ? `Responsável: ${pickedLabels.join(", ")}` : "Todos os responsáveis"}</span>
    </div>
    <nav className="catalog-counters catalog-tabs" aria-label="Estado dos casos">
      <Link className={`metric catalog-tab${showClosed ? "" : " is-active"}`} href={link({ estado: null })} aria-current={showClosed ? undefined : "page"}><span>Abertos</span><strong>{open.length}</strong></Link>
      <Link className={`metric catalog-tab${showClosed ? " is-active" : ""}`} href={link({ estado: "encerrados" })} aria-current={showClosed ? "page" : undefined}><span>Encerrados</span><strong>{closed.length}</strong></Link>
    </nav>
    {showClosed ? <><div className="list">{pageOf(closed).map((item) => <div className="list-row case-row" key={item.key}>
      <div><span className="status">{item.kind}</span> <span className="support-case-state is-closed">{item.outcome}</span> <strong>{item.title}</strong><p className="muted">{item.detail}</p><small className="muted">Encerrado em {shortDate(parseDbDate(item.closedAt))} · <strong className={`case-owner${owner.get(item.key)?.id === admin.id ? " is-me" : ""}`}>Responsável: {ownerLabel(item.key)}</strong></small></div>
      <div className="verification-row-actions"><Link className="button button-ghost button-sm" href={item.href}>Ver</Link></div>
    </div>)}{!closed.length && <section className="panel catalog-empty"><span className="catalog-empty-icon" aria-hidden="true">✓</span><h2>Nenhum caso encerrado</h2><p className="muted">{picked.length === 1 && picked[0] === NOBODY ? "Todo caso encerrado teve um responsável." : "Os casos encerrados aparecem aqui, do mais recente para o mais antigo."}</p></section>}</div>
    <PaginationControls page={page} total={closed.length} pageSize={PAGE_SIZE} basePath={link({ estado: "encerrados" })}/></> : <>
    <p className="muted">{open.length} {open.length === 1 ? "caso aberto" : "casos abertos"}, do mais antigo para o mais recente. Para abrir um caso, alguém precisa assumi-lo: o responsável fica registrado e é quem responde.</p>
    <div className="list">{pageOf(open).map((item) => { const taken = owner.get(item.key); return <div className="list-row case-row" key={item.key}>
      <div><span className="status">{item.kind}</span> {item.waiting && <span className="support-case-state is-answered">{item.waiting}</span>} <strong>{item.title}</strong><p className="muted">{item.detail}</p><small className="muted">Aberto em {shortDate(parseDbDate(item.createdAt))} · {taken ? <strong className={`case-owner${taken.id === admin.id ? " is-me" : ""}`}>Responsável: {taken.id === admin.id ? "você" : taken.name}</strong> : "Ninguém assumiu ainda"}</small></div>
      <div className="verification-row-actions">{taken ? <><Link className="button button-dark button-sm" href={item.href}>Abrir</Link>{taken.id !== admin.id && isAdmin && <form action={assignCaseAction.bind(null, item.key, undefined)}><button className="button button-ghost button-sm">Assumir no lugar</button></form>}</> : <form action={assignCaseAction.bind(null, item.key, item.href)}><button className="button button-dark button-sm">Assumir e abrir</button></form>}</div>

    </div>; })}{!open.length && <section className="panel catalog-empty"><span className="catalog-empty-icon" aria-hidden="true">✓</span><h2>Nenhum caso aberto</h2><p className="muted">{who.size ? "Nenhum caso aberto com este filtro." : "Denúncias, avaliações denunciadas, contestações e faltas aparecem aqui assim que surgirem, e chegam também no sino."}</p></section>}</div>
    <PaginationControls page={page} total={open.length} pageSize={PAGE_SIZE} basePath={link({ estado: null })}/>
    </>}
    </div>
  </DashboardShell>;
}
