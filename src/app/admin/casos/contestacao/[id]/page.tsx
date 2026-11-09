import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { assignCaseAction, resolveDisputeAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { FlashMessage } from "@/components/flash-message";
import { Role } from "@/lib/domain";
import { money, parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Contestação" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  nota: "Explique a decisão com pelo menos 10 caracteres. As duas partes recebem esse texto.",
  responsavel: "Só o responsável pelo caso pode decidir. Assuma o caso para decidir.",
  decidida: "Esta contestação já foi decidida.",
  valor: "Para devolver parte, informe um valor maior que zero e menor que o total pago.",
  parcial: "A devolução parcial ainda não está disponível: falta aplicar a migração 20261101120000 no banco.",
  "1": "Não foi possível registrar a decisão. Tente de novo.",
};

// A contested conversation: why the customer contested, the whole chat (for "Perguntas por mensagem",
// whether the answers answer the questions) and the decision: refund the customer (and warn the
// consultant), refund part of it (questions answered only in part) or release the amount to the
// consultant. Admins and support staff who took the case.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const staff = await requireUser([Role.ADMIN, Role.SUPPORT]);
  const isAdmin = staff.role === Role.ADMIN;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: booking } = await supabase.from("Booking").select("id, status, format, startsAt, durationMinutes, totalCents, disputedAt, disputeReason, customerId, questions, professionalProfile:ProfessionalProfile(userId), conversation:Conversation(id)").eq("id", id).maybeSingle();
  if (!booking) notFound();
  const one = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] ?? null : value;
  const consultantId = (one(booking.professionalProfile) as { userId?: string } | null)?.userId ?? "";
  const conversationId = (one(booking.conversation) as { id?: string } | null)?.id ?? "";
  const [{ data: assignment }, { data: people }, { data: messages }] = await Promise.all([
    supabase.from("CaseAssignment").select("adminUserId, admin:User(name)").eq("caseKey", `dispute:${id}`).maybeSingle(),
    supabase.from("User").select("id, name, role").in("id", [booking.customerId, consultantId].filter(Boolean)),
    conversationId ? supabase.from("Message").select("id, body, senderId, createdAt, automatic").eq("conversationId", conversationId).order("createdAt").limit(1000) : { data: [] },
  ]);
  const open = booking.status === "DISPUTED";
  if (!assignment && open) redirect("/admin/casos?erro=assumir");
  // Support staff open only the cases they took; admins open every case.
  if (!isAdmin && assignment?.adminUserId !== staff.id) notFound();
  const mine = assignment?.adminUserId === staff.id;
  const name = (userId: string) => ((people ?? []) as { id: string; name: string }[]).find((person) => person.id === userId)?.name ?? "Conta removida";
  const isMessage = booking.format === "MESSAGE";
  const rows = (messages ?? []) as { id: string; body: string; senderId: string; createdAt: string; automatic?: boolean }[];

  return <DashboardShell mode={isAdmin ? "admin" : "support"} title="Contestação">
    {query.erro && <FlashMessage param="erro">{ERRORS[query.erro] ?? ERRORS["1"]}</FlashMessage>}
    <p className="case-back"><Link className="text-link" href="/admin/casos">← Voltar para Casos</Link></p>
    <div className="case-layout">
      <section className="panel case-conversation form-stack">
        <header className="support-case-top"><div><span className="status">Contestação</span> <span className={`support-case-state${open ? " is-urgent" : " is-closed"}`}>{open ? "Aguardando decisão" : "Decidida"}</span></div><small className="muted">Contestada em {booking.disputedAt ? shortDate(parseDbDate(booking.disputedAt)) : "—"}</small></header>
        <div className="dispute-reason"><span className="eyebrow">Motivo informado pelo cliente</span><p>{booking.disputeReason || "Sem descrição."}</p></div>
        <div className="form-stack"><span className="eyebrow">{isMessage ? "Perguntas e respostas" : "Chat da conversa"}</span>
          {rows.length ? <div className="dispute-transcript">{rows.map((message) => <div className={`message ${message.senderId === consultantId ? "message-consultant" : "message-customer"}`} key={message.id}>
            <small>{message.senderId === consultantId ? `${name(consultantId)} (consultor)` : `${name(booking.customerId)} (cliente)`}</small>
            <span>{message.body}</span>
            {message.automatic && <span className="message-automatic">Enviada automaticamente pela Insidely</span>}
            <span className="message-meta">{shortDate(parseDbDate(message.createdAt))}</span>
          </div>)}</div> : <p className="muted">Nenhuma mensagem no chat.</p>}
        </div>
        {open && mine && <form className="support-reply" action={resolveDisputeAction.bind(null, id)}>
          <label className="support-reply-label" htmlFor="note">Explique a decisão</label>
          <textarea className="textarea" id="note" name="note" rows={3} maxLength={500} required minLength={10} placeholder={isMessage ? "Ex.: As respostas não tratam das perguntas enviadas; a 2ª e a 3ª foram respondidas com uma palavra." : "Ex.: O registro da sala mostra que o consultor não entrou."}/>
          <label className="check-row"><input type="checkbox" name="warn" defaultChecked/><span>Se o valor for devolvido (todo ou em parte), advertir o consultor (a cada 3 advertências, suspensão de 1 semana; depois, de 1 mês; depois, banimento).</span></label>
          <div className="dispute-partial">
            <label className="support-reply-label" htmlFor="refund">Devolver só uma parte (opcional)</label>
            <div className="dispute-partial-row"><span>R$</span><input className="input" id="refund" name="refund" inputMode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" placeholder="0,00" aria-describedby="refund-help"/><button className="button button-ghost button-sm" name="decision" value="PARTIAL">Devolver esta parte</button></div>
            <small className="muted" id="refund-help">Total pago: {money(booking.totalCents)}. Use quando só parte das perguntas foi respondida: o cliente recebe este valor e o consultor, a parte proporcional do que não foi devolvido.</small>
          </div>
          <div className="support-reply-actions">
            <button className="button button-ghost button-sm" name="decision" value="RELEASE">Liberar tudo ao consultor</button>
            <button className="button button-dark" name="decision" value="REFUND">Devolver tudo ao cliente</button>
          </div>
        </form>}
        {open && !mine && <div className="case-not-mine"><p className="muted">Este caso é de <strong>{(one(assignment?.admin) as { name?: string } | null)?.name ?? "outra pessoa"}</strong>. Só o responsável decide.</p>{isAdmin && <form action={assignCaseAction.bind(null, `dispute:${id}`, `/admin/casos/contestacao/${id}`)}><button className="button button-ghost button-sm">Assumir no lugar</button></form>}</div>}
      </section>
      <aside className="case-aside">
        <div className="case-fact"><span>Responsável</span><strong>{mine ? "Você" : (one(assignment?.admin) as { name?: string } | null)?.name ?? "ninguém"}</strong></div>
        <div className="case-fact"><span>Cliente</span><strong>{name(booking.customerId)}</strong></div>
        <div className="case-fact"><span>Consultor</span><strong>{name(consultantId)}</strong></div>
        <div className="case-fact"><span>{isMessage ? "Perguntas por mensagem" : "Conversa por vídeo"}</span><strong>{shortDate(parseDbDate(booking.startsAt))}</strong><small className="muted">{money(booking.totalCents)}{isMessage && Array.isArray(booking.questions) ? ` · ${booking.questions.length} pergunta(s)` : ""}</small></div>
        {consultantId && (!isAdmin && ["ADMIN", "SUPPORT"].includes((people ?? []).find((person: { id: string }) => person.id === consultantId)?.role) ? <p className="muted">Conta da equipe: advertência e suspensão só por um administrador.</p> : <Link className="button button-ghost button-sm" href={isAdmin ? `/admin/usuarios/${consultantId}` : `/admin/sancoes/${consultantId}`}>{isAdmin ? "Ver conta do consultor" : "Advertir ou suspender o consultor"}</Link>)}
      </aside>
    </div>
  </DashboardShell>;
}
