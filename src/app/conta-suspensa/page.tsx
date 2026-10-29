import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { parseDbDate } from "@/lib/format";
import { getSuspension, requireUser } from "@/lib/session";

export const metadata = { title: "Conta suspensa" };
export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  const user = await requireUser(undefined, { allowIncomplete: true, allowSuspended: true, nextPath: "/conta-suspensa" });
  const suspension = await getSuspension(user.id);
  if (!suspension) redirect("/continuar");
  const until = suspension.until ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parseDbDate(suspension.until)) : null;
  return <main className="auth-page"><section className="auth-art" style={{ background: "var(--amber)" }}><h1>Conta suspensa.</h1></section><section className="auth-panel"><div className="auth-form form-stack">
    <h2>Sua conta está suspensa{until ? ` até ${until}` : ""}.</h2>
    <p>A equipe da Insidely suspendeu esta conta por descumprimento dos <Link className="text-link" href="/termos">Termos de Uso</Link>. Enquanto a suspensão durar, não é possível agendar, receber agendamentos nem enviar mensagens.</p>
    {suspension.reason && <p className="muted"><strong>Motivo:</strong> {suspension.reason}</p>}
    <p className="muted">Se acredita que houve um engano, <Link className="text-link" href="/suporte">fale com o suporte</Link>.</p>
    <form action={logoutAction}><button className="button button-dark" type="submit">Sair</button></form>
  </div></section></main>;
}
