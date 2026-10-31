import { preferredDashboardMode } from "@/lib/dashboard-mode";
import Link from "next/link";
import { notFound } from "next/navigation";
import { closeSupportCaseAction, replySupportCaseAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { FlashMessage } from "@/components/flash-message";
import { SupportThread } from "@/components/support-thread";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { getSupportCase, OPEN_REPORT_STATUSES, personCaseStatus } from "@/lib/support-threads";

export const metadata = { title: "Seu caso" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = { curta: "Escreva sua mensagem antes de enviar.", limite: "Você enviou muitas mensagens na última hora. Aguarde um pouco.", fechado: "Este caso já foi encerrado. Se precisar, abra um novo pedido de ajuda." };

// One support case for the person who opened it: the conversation with the team, a reply box,
// and "resolvido" to close it. Replies continue this case instead of opening a new one.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const found = await getSupportCase(id);
  if (!found || found.report.reporterId !== user.id) notFound();
  const { report, messages } = found;
  const open = OPEN_REPORT_STATUSES.includes(report.status);
  const answered = messages.some((message) => message.fromStaff);
  // The team answered last and now waits for the person (status IN_REVIEW).
  const waitingOnPerson = report.status === "IN_REVIEW";
  return <DashboardShell mode={await preferredDashboardMode(user.role)} title={report.category} canConsultant={user.role === Role.CONSULTANT}>
    {query.ok === "enviada" && <FlashMessage>Mensagem enviada. A equipe vai responder aqui mesmo.</FlashMessage>}
    {query.ok === "resolvido" && <FlashMessage>Obrigado! O caso foi marcado como resolvido.</FlashMessage>}
    {query.erro && <p className="form-error" role="alert">{ERRORS[query.erro] ?? "Não foi possível enviar. Tente de novo."}</p>}
    <p className="case-back"><Link className="text-link" href="/dashboard/suporte">← Seus casos</Link></p>
    <section className="panel support-case">
      <header className="support-case-top"><div><span className="status">{report.targetUserId || report.bookingId ? "Denúncia" : "Suporte"}</span> <span className={`support-case-state${report.status === "IN_REVIEW" ? " is-answered" : open ? "" : " is-closed"}`}>{personCaseStatus(report.status)}</span></div><small className="muted">Aberto em {shortDate(parseDbDate(report.createdAt))}</small></header>
      <SupportThread opening={{ body: report.description, createdAt: report.createdAt }} messages={messages} viewer="person" personName="Você" closedLabel={open ? null : report.status === "RESOLVED" ? "Caso resolvido" : "Caso encerrado"}/>
      {open && !answered && <p className="support-waiting">A equipe da Insidely recebeu seu caso e responde por aqui. Você também recebe um aviso no sino e por e-mail.</p>}
      {/* Waiting on the person: did the answer solve it? "Não" opens the reply on this same case. */}
      {open && waitingOnPerson && <div className="support-decide">
        <div><strong>O suporte respondeu. Isso resolveu seu problema?</strong><p className="muted">Se resolveu, encerre o caso. Se não, responda aqui mesmo: a conversa continua no mesmo caso.</p></div>
        <div className="support-decide-actions">
          <form action={closeSupportCaseAction.bind(null, report.id)}><button className="button button-accent">Sim, foi resolvido</button></form>
          <a className="button button-ghost" href="#responder">Não, ainda preciso de ajuda</a>
        </div>
      </div>}
      {open && <form className={`support-reply${waitingOnPerson ? " is-folded" : ""}`} id="responder" action={replySupportCaseAction.bind(null, report.id)}>
        <label className="support-reply-label" htmlFor="body">{waitingOnPerson ? "Conte o que ainda falta resolver" : "Quer acrescentar algo?"}</label>
        <textarea className="textarea" id="body" name="body" rows={4} maxLength={4000} required placeholder={waitingOnPerson ? "Explique o que continua acontecendo ou responda à pergunta do suporte." : "Escreva aqui. A equipe responde neste mesmo caso."}/>
        <div className="support-reply-actions">{waitingOnPerson && <a className="button button-ghost button-sm" href="#">Cancelar</a>}<button className="button button-dark">Enviar mensagem</button></div>
      </form>}
    </section>
  </DashboardShell>;
}
