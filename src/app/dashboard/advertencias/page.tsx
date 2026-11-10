import Link from "next/link";
import { ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { submitAppealAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSanctionsForUser, type Sanction } from "@/lib/appeals";
import { Role } from "@/lib/domain";
import { enforcementSummary } from "@/lib/enforcement-policy";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Advertências e recursos" };
export const dynamic = "force-dynamic";

const feedback: Record<string, [ok: boolean, text: string]> = {
  ok: [true, "Recurso enviado. O suporte vai analisar e você recebe a decisão por notificação."],
  curto: [false, "Explique o motivo do recurso com pelo menos 20 caracteres."],
  duplicado: [false, "Você já recorreu desta advertência ou suspensão. Cada uma aceita um recurso."],
  erro: [false, "Não foi possível enviar o recurso agora. Tente novamente."],
};

function AppealStatus({ sanction }: { sanction: Sanction }) {
  const appeal = sanction.appeal;
  if (!appeal) return <details className="cancel-booking-details appeal-form"><summary><span>Recorrer</span></summary><div className="cancel-booking-confirmation">
    <h3>Por que foi injusto?</h3>
    <p className="muted">Conte o que aconteceu. O suporte lê a conversa e decide. Se aceitar, {sanction.kind === "WARNING" ? "a advertência sai da sua conta e deixa de contar para suspensão" : "a suspensão sai da sua conta e, se ainda estiver valendo, termina na hora"}.</p>
    <form action={submitAppealAction} className="form-stack"><input type="hidden" name="kind" value={sanction.kind}/><input type="hidden" name="sanctionId" value={sanction.id}/><input type="hidden" name="returnTo" value="/dashboard/advertencias"/><textarea className="textarea" name="reason" rows={4} minLength={20} maxLength={2000} required aria-label="Motivo do recurso" placeholder="Ex.: Eu estava passando o número do protocolo de um processo seletivo, não um telefone."/><button className="button button-dark button-sm">Enviar recurso</button></form>
  </div></details>;
  if (appeal.status === "PENDING") return <p className="appeal-status is-pending">Recurso em análise desde {shortDate(parseDbDate(appeal.createdAt))}.</p>;
  return <p className="appeal-status is-rejected">Recurso não aceito{appeal.staffNote ? `: ${appeal.staffNote}` : "."}</p>;
}

// The person's warnings and suspensions, with an appeal for each (one per warning or suspension).
export default async function Page({ searchParams }: { searchParams: Promise<{ recurso?: string }> }) {
  const user = await requireUser([Role.USER, Role.CONSULTANT]);
  const query = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { active, removed } = await getSanctionsForUser(createSupabaseServiceClient() as any, user.id);
  const warnings = active.filter((item) => item.kind === "WARNING").length;
  const notice = query.recurso ? feedback[query.recurso] : null;
  return <DashboardShell mode="user" title="Advertências e recursos" canConsultant={user.role === Role.CONSULTANT}>
    {notice && <p className={notice[0] ? "form-feedback" : "form-error"} role={notice[0] ? "status" : "alert"}>{notice[1]}</p>}
    <section className="panel form-stack">
      <span className="eyebrow">Sua conta</span>
      <h2>{active.length ? `${warnings} ${warnings === 1 ? "advertência" : "advertências"} na sua conta` : "Nenhuma advertência na sua conta."}</h2>
      <p className="muted">{enforcementSummary()} Mensagens bloqueadas no chat geram no máximo uma advertência automática a cada 24 horas. Se achar que alguma foi injusta, recorra: o suporte analisa e, se concordar, ela é removida.</p>
    </section>
    {active.length > 0 && <div className="list sanctions-list">{active.map((sanction) => <article className="panel sanction-card" key={`${sanction.kind}-${sanction.id}`}>
      <header><span className="sanction-icon" aria-hidden="true">{sanction.kind === "WARNING" ? <TriangleAlert size={18}/> : <ShieldAlert size={18}/>}</span><div><strong>{sanction.kind === "WARNING" ? (sanction.automatic ? "Advertência automática" : "Advertência") : sanction.endsAt ? `Suspensão até ${shortDate(parseDbDate(sanction.endsAt))}` : "Banimento"}</strong><small className="muted">{shortDate(parseDbDate(sanction.createdAt))}</small></div></header>
      <p>{sanction.reason}</p>
      <AppealStatus sanction={sanction}/>
    </article>)}</div>}
    {removed.length > 0 && <section className="panel form-stack"><span className="eyebrow">Removidas após recurso</span>{removed.map((item, index) => <div className="sanction-removed" key={index}><ShieldCheck size={16} aria-hidden="true"/><span>{item.kind === "WARNING" ? "Advertência" : "Suspensão"} de {shortDate(parseDbDate(item.sanctionAt))} removida{item.decidedAt ? ` em ${shortDate(parseDbDate(item.decidedAt))}` : ""}.</span></div>)}</section>}
    <p className="muted">As regras estão nos <Link className="text-link" href="/termos">Termos de Uso</Link>.</p>
  </DashboardShell>;
}
