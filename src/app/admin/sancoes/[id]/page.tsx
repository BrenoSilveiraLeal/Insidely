import { notFound, redirect } from "next/navigation";
import { suspendUserAction, warnUserAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { enforcementSummary, nextEnforcementStep } from "@/lib/enforcement-policy";
import { parseDbDate, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Advertências e suspensões" };
export const dynamic = "force-dynamic";

type Warning = { id: string; reason: string; createdAt: string };
type Suspension = { id: string; reason: string; endsAt: string | null; automatic: boolean; createdAt: string };

// Support staff's view of one account: its warnings and suspensions, and the forms to warn, suspend
// or ban. No identity data (CPF, birth date) is shown here.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const staff = await requireUser([Role.ADMIN, Role.SUPPORT]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (staff.role === Role.ADMIN) redirect(`/admin/usuarios/${id}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: user } = await supabase.from("User").select("id, name, email, role, suspendedAt, suspendedUntil, suspensionReason").eq("id", id).maybeSingle();
  if (!user || user.role === Role.ADMIN || user.role === Role.SUPPORT) notFound();
  const [warnings, suspensions] = await Promise.all([
    supabase.from("AccountWarning").select("id, reason, createdAt").eq("userId", id).order("createdAt", { ascending: false }),
    supabase.from("AccountSuspension").select("id, reason, endsAt, automatic, createdAt").eq("userId", id).order("createdAt", { ascending: false }),
  ]);
  const warningRows = (warnings.data ?? []) as Warning[];
  const suspensionRows = (suspensions.data ?? []) as Suspension[];
  const banned = Boolean(user.suspendedAt) && !user.suspendedUntil;
  const suspended = Boolean(user.suspendedAt) && (!user.suspendedUntil || parseDbDate(user.suspendedUntil) > new Date());
  const when = (value: string) => shortDate(parseDbDate(value));
  return <DashboardShell mode="support" title={user.name}>
    {query.ok && <p className="form-feedback" role="status">{query.ok === "advertida" ? "Advertência registrada e enviada à pessoa." : query.ok === "banida" ? "Advertência registrada. A conta chegou ao limite e foi banida." : "Conta suspensa."}</p>}
    {query.erro && <p className="form-error" role="alert">{query.erro}</p>}
    <section className="panel form-stack">
      <span className="eyebrow">{user.role === "CONSULTANT" ? "Consultor" : "Cliente"} · {user.email}</span>
      <h2>{banned ? "Conta banida" : suspended ? `Suspensa até ${when(user.suspendedUntil)}` : "Conta ativa"}</h2>
      {suspended && !banned && <p className="muted">Motivo: {user.suspensionReason}</p>}
      <p className="muted">{enforcementSummary()}</p>
    </section>
    <section className="panel form-stack">
      <span className="eyebrow">Advertências · {warningRows.length}</span>
      <p className="muted">Próximo passo: <strong>{suspended ? "aguardar o fim da suspensão" : nextEnforcementStep(warningRows.length, suspensionRows.length).text}</strong>.</p>
      {warningRows.length > 0 && <div className="list">{warningRows.map((item) => <div className="list-row" key={item.id}><p>{item.reason}</p><span className="muted">{when(item.createdAt)}</span></div>)}</div>}
      {!banned && <form action={warnUserAction.bind(null, user.id)} className="form-stack"><label className="field"><span>Nova advertência (a pessoa recebe por e-mail e notificação)</span><textarea className="textarea" name="reason" minLength={10} maxLength={500} required/></label><button className="button button-ghost button-sm" type="submit">Registrar advertência</button></form>}
    </section>
    <section className="panel form-stack">
      <span className="eyebrow">Suspensões · {suspensionRows.length}</span>
      {suspensionRows.length > 0 && <div className="list">{suspensionRows.map((item) => <div className="list-row" key={item.id}><p>{item.reason}{item.automatic ? " (automática)" : ""}</p><span className="muted">{when(item.createdAt)} · {item.endsAt ? `até ${when(item.endsAt)}` : "permanente"}</span></div>)}</div>}
      {!suspended && <form action={suspendUserAction.bind(null, user.id)} className="form-stack">
        <p className="muted">Em casos graves, a suspensão ou o banimento pode ser aplicado direto, sem esperar as 3 advertências. A conta fica sem acesso, sai da busca e as conversas futuras de consultor são canceladas com reembolso integral.</p>
        <label className="field"><span>Duração</span><select className="select" name="duration" defaultValue="7"><option value="7">7 dias (1 semana)</option><option value="30">30 dias (1 mês)</option><option value="permanent">Permanente (banimento)</option></select></label>
        <label className="field"><span>Motivo (aparece para a pessoa)</span><textarea className="textarea" name="reason" minLength={10} maxLength={500} required/></label>
        <button className="button button-danger button-sm" type="submit">Aplicar</button>
      </form>}
    </section>
  </DashboardShell>;
}
