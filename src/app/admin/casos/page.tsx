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

type Case = { key: string; kind: string; title: string; detail: string; createdAt: string; href: string };

// One queue for everything that needs a person: open reports, reported reviews, disputes and
// one-sided attendance (no-shows) of the last 14 days. Each case can be taken by an admin.
export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const admin = await requireUser([Role.ADMIN]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const since = daysAgo(14);
  const [{ data: reports }, { data: reviewReports }, { data: disputes }, { data: checked }, { data: assignments }] = await Promise.all([
    supabase.from("Report").select("id, category, description, targetUserId, bookingId, createdAt").neq("status", "RESOLVED").order("createdAt"),
    supabase.from("ReviewReport").select("id, reason, reviewComment, createdAt").eq("status", "OPEN").order("createdAt"),
    supabase.from("Booking").select("id, customerId, disputedAt, updatedAt").eq("status", "DISPUTED").order("updatedAt"),
    supabase.from("Booking").select("id, customerId, startsAt, professionalProfile:ProfessionalProfile(userId)").not("noShowCheckedAt", "is", null).gte("startsAt", since).in("status", ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"]),
    supabase.from("CaseAssignment").select("caseKey, adminUserId, admin:User(name)"),
  ]);
  const cases: Case[] = [
    ...((reports ?? []) as { id: string; category: string; description: string; targetUserId: string | null; bookingId: string | null; createdAt: string }[]).map((item) => ({ key: `report:${item.id}`, kind: item.targetUserId || item.bookingId ? "Denúncia" : "Suporte", title: item.category, detail: item.description, createdAt: item.createdAt, href: `/admin/casos/relato/${item.id}` })),
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
  return <DashboardShell mode="admin" title="Casos">
    {ok && <FlashMessage key={ok}>{ok === "arquivado" ? "Caso arquivado. A resposta foi enviada para quem abriu." : "Caso resolvido. A resposta foi enviada para quem abriu."}</FlashMessage>}
    <p className="muted">{cases.length} {cases.length === 1 ? "caso aberto" : "casos abertos"}, do mais antigo para o mais recente.</p>
    <div className="list">{cases.map((item) => { const taken = owner.get(item.key); return <div className="list-row case-row" key={item.key}>
      <div><span className="status">{item.kind}</span> <strong>{item.title}</strong><p className="muted">{item.detail}</p><small className="muted">Aberto em {shortDate(parseDbDate(item.createdAt))} · {taken ? `Responsável: ${taken.id === admin.id ? "você" : taken.name}` : "Sem responsável"}</small></div>
      <div className="verification-row-actions"><Link className="button button-dark button-sm" href={item.href}>Abrir</Link>{taken?.id !== admin.id && <form action={assignCaseAction.bind(null, item.key)}><button className="button button-ghost button-sm">{taken ? "Assumir no lugar" : "Assumir"}</button></form>}</div>
    </div>; })}{!cases.length && <section className="panel catalog-empty"><span className="catalog-empty-icon" aria-hidden="true">✓</span><h2>Nenhum caso aberto</h2><p className="muted">Denúncias, avaliações denunciadas, contestações e faltas aparecem aqui assim que surgirem, e chegam também no sino.</p></section>}</div>
  </DashboardShell>;
}
