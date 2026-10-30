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
  return <DashboardShell mode={user.role === Role.CONSULTANT ? "consultant" : "user"} title={report.category} canConsultant={user.role === Role.CONSULTANT}>
    {query.ok === "enviada" && <FlashMessage>Mensagem enviada. A equipe vai responder aqui mesmo.</FlashMessage>}
    {query.ok === "resolvido" && <FlashMessage>Obrigado! O caso foi marcado como resolvido.</FlashMessage>}
    {query.erro && <p className="form-error" role="alert">{ERRORS[query.erro] ?? "Não foi possível enviar. Tente de novo."}</p>}
    <p className="case-back"><Link className="text-link" href="/dashboard/suporte">← Seus casos</Link></p>
    <section className="panel support-case">
      <header className="support-case-top"><div><span className="status">{report.targetUserId || report.bookingId ? "Denúncia" : "Suporte"}</span> <span className={`support-case-state${report.status === "IN_REVIEW" ? " is-answered" : open ? "" : " is-closed"}`}>{personCaseStatus(report.status)}</span></div><small className="muted">Aberto em {shortDate(parseDbDate(report.createdAt))}</small></header>
      <SupportThread opening={{ body: report.description, createdAt: report.createdAt }} messages={messages} viewer="person" personName="Você" closedLabel={open ? null : report.status === "RESOLVED" ? "Caso resolvido" : "Caso encerrado"}/>
      {open && !answered && <p className="support-waiting">A equipe da Insidely recebeu seu caso e responde por aqui. Você também recebe um aviso no sino e por e-mail.</p>}
      {open && <form className="support-reply" action={replySupportCaseAction.bind(null, report.id)}>
        <label className="sr-only" htmlFor="body">Sua mensagem</label>
        <textarea className="textarea" id="body" name="body" rows={3} maxLength={4000} required placeholder={answered ? "Ainda precisa de ajuda? Responda aqui." : "Quer acrescentar algo? Escreva aqui."}/>
        <div className="support-reply-actions"><button className="button button-dark">Enviar mensagem</button></div>
      </form>}
    </section>
    {open && answered && <form className="panel support-resolve" action={closeSupportCaseAction.bind(null, report.id)}><div><strong>O suporte resolveu seu problema?</strong><p className="muted">Ao confirmar, o caso é encerrado. Se não, é só responder acima.</p></div><button className="button button-accent">Sim, foi resolvido</button></form>}
  </DashboardShell>;
}
