import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { answerReportAction, assignCaseAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { FlashMessage } from "@/components/flash-message";
import { SupportThread } from "@/components/support-thread";
import { Role } from "@/lib/domain";
import { bookingStatusLabel, money, parseDbDate, shortDate, visibleEmail } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getSupportCase, OPEN_REPORT_STATUSES } from "@/lib/support-threads";

export const metadata = { title: "Caso" };
export const dynamic = "force-dynamic";

type Person = { id: string; name: string | null; email: string; role: string };

const ERRORS: Record<string, string> = {
  resposta: "Escreva uma mensagem de 10 a 4000 caracteres.",
  fechado: "Este caso já foi encerrado.",
  responsavel: "Só o responsável pelo caso pode respondê-lo. Assuma o caso para responder.",
  "1": "Não foi possível salvar. Tente de novo.",
};

// One support request or report, handled as a conversation with the person who opened it.
// Left: the thread and the reply box. Right: who is involved, the booking and who owns the case.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const admin = await requireUser([Role.ADMIN, Role.SUPPORT]);
  // Support staff answer the case; account pages, warnings and suspensions stay with admins.
  const isAdmin = admin.role === Role.ADMIN;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const found = await getSupportCase(id);
  if (!found) notFound();
  const { report, messages } = found;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const ids = [report.reporterId, report.targetUserId].filter(Boolean);
  const [{ data: people }, { data: booking }, { data: assignment }] = await Promise.all([
    ids.length ? supabase.from("User").select("id, name, email, role").in("id", ids) : { data: [] },
    report.bookingId ? supabase.from("Booking").select("id, startsAt, status, totalCents").eq("id", report.bookingId).maybeSingle() : { data: null },
    supabase.from("CaseAssignment").select("adminUserId, admin:User(name)").eq("caseKey", `report:${id}`).maybeSingle(),
  ]);
  // An open case opens only after someone took it (see /admin/casos); closed ones are history.
  if (!assignment && OPEN_REPORT_STATUSES.includes(report.status)) redirect("/admin/casos?erro=assumir");
  const mine = assignment?.adminUserId === admin.id;
  const ownerName = mine ? "você" : assignment ? (Array.isArray(assignment.admin) ? assignment.admin[0]?.name : assignment.admin?.name) ?? "Admin" : "ninguém";
  const byId = new Map(((people ?? []) as Person[]).map((person) => [person.id, person]));
  const reporter = byId.get(report.reporterId ?? ""), target = byId.get(report.targetUserId ?? "");
  const isSupport = !report.targetUserId && !report.bookingId;
  const open = OPEN_REPORT_STATUSES.includes(report.status);
  const waitingOnTeam = report.status === "OPEN";
  const role = (value: string) => value === "CONSULTANT" ? "Consultor" : value === "ADMIN" ? "Admin" : value === "SUPPORT" ? "Suporte" : "Cliente";
  const personCard = (label: string, person: Person | undefined) => <div className="case-fact"><span>{label}</span>{person ? <>{isAdmin ? <Link className="text-link" href={`/admin/usuarios/${person.id}`}>{person.name || "Sem nome"}</Link> : <strong>{person.name || "Sem nome"}</strong>}<small className="muted">{role(person.role)} · {visibleEmail(person.email) ?? "conta excluída"}</small></> : <small className="muted">Conta removida</small>}</div>;
  const stateLabel = waitingOnTeam ? "Aguardando a equipe" : report.status === "IN_REVIEW" ? "Aguardando a pessoa" : report.status === "RESOLVED" ? "Resolvido" : "Arquivado";

  return <DashboardShell mode={isAdmin ? "admin" : "support"} title={report.category}>
    {query.ok === "enviada" && <FlashMessage>Resposta enviada. A pessoa recebe um aviso no app e por e-mail.</FlashMessage>}
    {query.erro && <p className="form-error">{ERRORS[query.erro] ?? ERRORS["1"]}</p>}
    <p className="case-back"><Link className="text-link" href="/admin/casos">← Voltar para Casos</Link></p>
    <div className="case-layout">
      <section className="panel case-conversation">
        <header className="support-case-top"><div><span className="status">{isSupport ? "Suporte" : "Denúncia"}</span> <span className={`support-case-state${waitingOnTeam ? " is-urgent" : open ? " is-answered" : " is-closed"}`}>{stateLabel}</span></div><small className="muted">Aberto em {shortDate(parseDbDate(report.createdAt))}</small></header>
        <SupportThread opening={{ body: report.description, createdAt: report.createdAt }} messages={messages} viewer="staff" personName={reporter?.name?.split(" ")[0] ?? "Pessoa"} closedLabel={open ? null : report.status === "RESOLVED" ? "Caso resolvido" : "Caso arquivado"}/>
        {open && mine && <form className="support-reply" action={answerReportAction.bind(null, report.id)}>
          <label className="sr-only" htmlFor="reply">Resposta</label>
          <textarea className="textarea" id="reply" name="reply" rows={4} maxLength={4000} placeholder={isSupport ? "Ex.: Já ajustamos sua conta. Entre de novo e configure o autenticador em Configurações." : "Ex.: Analisamos a conversa e advertimos a pessoa. Obrigado por avisar."}/>
          <div className="support-reply-actions">
            <button className="button button-ghost button-sm" name="decision" value="DISMISSED">Arquivar</button>
            <button className="button button-ghost button-sm" name="decision" value="RESOLVED">Responder e encerrar</button>
            <button className="button button-dark" name="decision" value="REPLY">Enviar resposta</button>
          </div>
          <small className="muted">“Enviar resposta” deixa o caso aberto; “Encerrar” fecha o caso com esta mensagem.</small>
        </form>}
        {open && !mine && <div className="case-not-mine"><p className="muted">Este caso é de <strong>{ownerName}</strong>. Você pode acompanhar, mas só o responsável responde.</p>{isAdmin && <form action={assignCaseAction.bind(null, `report:${report.id}`, `/admin/casos/relato/${report.id}`)}><button className="button button-ghost button-sm">Assumir no lugar</button></form>}</div>}
      </section>
      <aside className="case-aside">
        <div className="case-fact"><span>Responsável</span><strong>{mine ? "Você" : ownerName}</strong></div>
        {personCard(isSupport ? "Quem pediu ajuda" : "Quem denunciou", reporter)}
        {!isSupport && personCard("Pessoa denunciada", target)}
        {booking && <div className="case-fact"><span>Conversa</span><strong>{shortDate(parseDbDate(booking.startsAt))}</strong><small className="muted">{bookingStatusLabel(booking.status)} · {money(booking.totalCents)}</small></div>}
        {isAdmin && target && open && <Link className="button button-ghost button-sm" href={`/admin/usuarios/${target.id}#suspensao`}>Advertir ou suspender</Link>}
        {isAdmin && reporter && <Link className="button button-ghost button-sm" href={`/admin/usuarios/${reporter.id}`}>Ver conta de quem abriu</Link>}
      </aside>
    </div>
  </DashboardShell>;
}
