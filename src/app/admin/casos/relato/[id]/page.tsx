import Link from "next/link";
import { notFound } from "next/navigation";
import { answerReportAction, assignCaseAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { FlashMessage } from "@/components/flash-message";
import { Role } from "@/lib/domain";
import { bookingStatusLabel, parseDbDate, reportStatusLabel, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Caso" };
export const dynamic = "force-dynamic";

type Person = { id: string; name: string | null; email: string; role: string };

const ERRORS: Record<string, string> = {
  resposta: "Escreva uma resposta de 10 a 2000 caracteres para quem abriu o caso.",
  fechado: "Este caso já foi encerrado por outra pessoa.",
  "1": "Não foi possível salvar. Tente de novo.",
};

// One report or support request: what was said, who is involved, and the reply that closes it.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const admin = await requireUser([Role.ADMIN]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: report } = await supabase.from("Report").select("id, reporterId, targetUserId, bookingId, category, description, status, resolution, createdAt, updatedAt").eq("id", id).maybeSingle();
  if (!report) notFound();
  const ids = [report.reporterId, report.targetUserId].filter(Boolean);
  const [{ data: people }, { data: booking }, { data: assignment }] = await Promise.all([
    ids.length ? supabase.from("User").select("id, name, email, role").in("id", ids) : { data: [] },
    report.bookingId ? supabase.from("Booking").select("id, startsAt, status, totalCents").eq("id", report.bookingId).maybeSingle() : { data: null },
    supabase.from("CaseAssignment").select("adminUserId, admin:User(name)").eq("caseKey", `report:${id}`).maybeSingle(),
  ]);
  const byId = new Map(((people ?? []) as Person[]).map((person) => [person.id, person]));
  const reporter = byId.get(report.reporterId ?? ""), target = byId.get(report.targetUserId ?? "");
  const isSupport = !report.targetUserId && !report.bookingId;
  const open = report.status === "OPEN" || report.status === "IN_REVIEW";
  const ownerName = assignment ? (assignment.adminUserId === admin.id ? "você" : (Array.isArray(assignment.admin) ? assignment.admin[0]?.name : assignment.admin?.name) ?? "Admin") : null;
  const role = (value: string) => value === "CONSULTANT" ? "Consultor" : value === "ADMIN" ? "Admin" : "Cliente";
  const personRow = (label: string, person: Person | undefined) => <div className="case-fact"><span>{label}</span>{person ? <><Link className="text-link" href={`/admin/usuarios/${person.id}`}>{person.name || "Sem nome"}</Link><small className="muted">{role(person.role)} · {person.email}</small></> : <small className="muted">Conta removida</small>}</div>;
  return <DashboardShell mode="admin" title={isSupport ? "Chamado de suporte" : "Denúncia"}>
    {query.ok === "analise" && <FlashMessage>Caso marcado como em análise e atribuído a você.</FlashMessage>}
    {query.erro && <p className="form-error">{ERRORS[query.erro] ?? ERRORS["1"]}</p>}
    <p className="case-back"><Link className="text-link" href="/admin/casos">← Voltar para Casos</Link></p>
    <section className="panel case-detail">
      <div className="case-detail-head"><div><span className="status">{isSupport ? "Suporte" : "Denúncia"}</span> <span className="status">{reportStatusLabel(report.status)}</span><h2>{report.category}</h2></div><small className="muted">Aberto em {shortDate(parseDbDate(report.createdAt))}<br />Responsável: {ownerName ?? "ninguém ainda"}</small></div>
      <blockquote className="case-quote">{report.description}</blockquote>
      <div className="case-facts">
        {personRow(isSupport ? "Quem pediu ajuda" : "Quem denunciou", reporter)}
        {!isSupport && personRow("Pessoa denunciada", target)}
        {booking && <div className="case-fact"><span>Conversa</span><strong>{shortDate(parseDbDate(booking.startsAt))}</strong><small className="muted">{bookingStatusLabel(booking.status)} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(booking.totalCents / 100)}</small></div>}
      </div>
      {!open && <div className="case-resolution"><span className="eyebrow">Resposta enviada</span><p>{report.resolution || "Encerrado sem resposta registrada."}</p><small className="muted">Encerrado em {shortDate(parseDbDate(report.updatedAt))}</small></div>}
    </section>
    {open && <section className="panel case-answer">
      <span className="eyebrow">Resolver</span>
      <h2>Responder {reporter?.name?.split(" ")[0] ?? "a pessoa"}</h2>
      <p className="muted">A resposta chega como notificação para quem abriu o caso e fica registrada aqui.{target ? " Para advertir ou suspender a pessoa denunciada, abra a conta dela." : ""}</p>
      <form className="form-stack" action={answerReportAction.bind(null, report.id)}>
        <div className="field"><label htmlFor="reply">Resposta</label><textarea className="textarea" id="reply" name="reply" maxLength={2000} placeholder={isSupport ? "Ex.: Já ajustamos sua conta. Entre de novo e configure o autenticador em Configurações." : "Ex.: Analisamos a conversa e advertimos a pessoa. Obrigado por avisar."}/></div>
        <div className="verification-row-actions">
          <button className="button button-accent" name="decision" value="RESOLVED">Responder e resolver</button>
          <button className="button button-ghost" name="decision" value="DISMISSED">Arquivar com resposta</button>
          {report.status === "OPEN" && <button className="button button-ghost" name="decision" value="IN_REVIEW">Marcar em análise</button>}
          {target && <Link className="button button-ghost" href={`/admin/usuarios/${target.id}#suspensao`}>Ver conta denunciada</Link>}
        </div>
      </form>
      {assignment?.adminUserId !== admin.id && <form action={assignCaseAction.bind(null, `report:${report.id}`)}><button className="button button-ghost button-sm">{assignment ? "Assumir no lugar" : "Assumir este caso"}</button></form>}
    </section>}
  </DashboardShell>;
}
