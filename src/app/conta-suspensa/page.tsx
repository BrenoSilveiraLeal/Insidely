import Link from "next/link";
import { redirect } from "next/navigation";
import { parseDbDate } from "@/lib/format";
import { getSuspension, requireUser } from "@/lib/session";
import { submitAppealAction } from "@/app/actions";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Conta suspensa" };
export const dynamic = "force-dynamic";

export default async function SuspendedPage({ searchParams }: { searchParams: Promise<{ recurso?: string }> }) {
  const query = await searchParams;
  const user = await requireUser(undefined, { allowIncomplete: true, allowSuspended: true, nextPath: "/conta-suspensa" });
  const suspension = await getSuspension(user.id);
  if (!suspension) redirect("/continuar");
  // The suspension in force (latest record) and whether it was already appealed (lib/appeals.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createSupabaseServiceClient() as any;
  const { data: record } = await service.from("AccountSuspension").select("id").eq("userId", user.id).order("createdAt", { ascending: false }).limit(1).maybeSingle();
  const { data: appeal } = record ? await service.from("SanctionAppeal").select("status, staffNote").eq("suspensionId", record.id).maybeSingle() : { data: null };
  const until = suspension.until ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parseDbDate(suspension.until)) : null;
  return <main className="auth-page"><section className="auth-art" style={{ background: "var(--amber)" }}><h1>Conta suspensa.</h1></section><section className="auth-panel"><div className="auth-form form-stack">
    <h2>Sua conta está suspensa{until ? ` até ${until}` : ""}.</h2>
    <p>A equipe da Insidely suspendeu esta conta por descumprimento dos <Link className="text-link" href="/termos">Termos de Uso</Link>. Enquanto a suspensão durar, não é possível abrir chats, receber chats nem enviar mensagens.</p>
    {suspension.reason && <p className="muted"><strong>Motivo:</strong> {suspension.reason}</p>}
    {query.recurso === "ok" && <p className="form-feedback" role="status">Recurso enviado. O suporte vai analisar e você recebe a decisão por e-mail e notificação.</p>}
    {query.recurso && query.recurso !== "ok" && <p className="form-error" role="alert">{query.recurso === "curto" ? "Explique o motivo com pelo menos 20 caracteres." : query.recurso === "duplicado" ? "Você já recorreu desta suspensão." : "Não foi possível enviar o recurso agora. Tente novamente."}</p>}
    {record && !appeal && <form action={submitAppealAction} className="form-stack"><input type="hidden" name="kind" value="SUSPENSION"/><input type="hidden" name="sanctionId" value={record.id}/><input type="hidden" name="returnTo" value="/conta-suspensa"/><label className="field"><span>Acha que foi injusto? Recorra</span><textarea className="textarea" name="reason" rows={4} minLength={20} maxLength={2000} required placeholder="Conte o que aconteceu. O suporte analisa e, se concordar, a suspensão é removida e sua conta volta na hora."/></label><button className="button button-accent" type="submit">Enviar recurso</button></form>}
    {appeal?.status === "PENDING" && <p className="form-feedback" role="status">Seu recurso está em análise pelo suporte.</p>}
    {appeal?.status === "REJECTED" && <p className="muted">Seu recurso foi analisado e não foi aceito{appeal.staffNote ? `: ${appeal.staffNote}` : "."}</p>}
    <p className="muted">Outras dúvidas? <Link className="text-link" href="/suporte">Fale com o suporte</Link>.</p>
    <form action="/auth/sair" method="post"><button className="button button-dark" type="submit">Sair</button></form>
  </div></section></main>;
}
