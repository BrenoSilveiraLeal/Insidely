import { unblockUserAction } from "@/app/actions";
import { PushToggle } from "@/components/push-toggle";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import Link from "next/link";
import { parseDbDate, shortDate } from "@/lib/format";
import { getUserById } from "@/lib/queries";
import { Role, STAFF_ROLES } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { calendarSyncText, GoogleCalendarPanel } from "@/components/google-calendar-panel";
import { getCalendarLink } from "@/lib/google-calendar-link";
import { AccountDangerZone } from "@/components/profile-management";
import { ChangePasswordForm } from "@/components/auth-form";
import { ProfileImageForm } from "@/components/profile-image-form";
import { AccountNameForm } from "@/components/account-name-form";
import { MfaSettings } from "@/components/mfa-settings";
import { EmailChangeForm } from "@/components/email-change-form";
import { requireUser } from "@/lib/session";
import { getCustomerIdentity, getCustomerReputations } from "@/lib/customer-identity";
import { CustomerIdentityForm } from "@/components/customer-identity-form";
import { accountHasPassword } from "@/lib/auth-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Minha conta" };
export default async function Page({ searchParams }: { searchParams: Promise<{ context?: string; email?: string; mfa?: string; bloqueio?: string; sync?: string; adicionadas?: string; removidos?: string }> }) {
  const params = await searchParams;
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN, Role.SUPPORT], { allowWithoutMfa: true });
  const staff = STAFF_ROLES.includes(user.role);
  // The admin notice only shows while this session has not passed two-step verification.
  const { data: assurance } = await (await createSupabaseServerClient()).auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaActive = assurance?.currentLevel === "aal2";
  const consultantContext = user.role === Role.CONSULTANT && params.context === "consultant";
  const stored = await getUserById(user.id);
  if (!stored) return null;
  // Google-only accounts have no password yet, so they create one instead of changing it.
  const { data: { user: authUser } } = await (await createSupabaseServerClient()).auth.getUser();
  const hasPassword = authUser ? accountHasPassword(authUser) : true;
  const emailNotices: Record<string, { ok: boolean; text: string }> = {
    alterado: { ok: true, text: "E-mail alterado. Use o novo endereço para entrar." },
    link_invalido: { ok: false, text: "Este link de troca de e-mail expirou ou já foi usado. Peça um novo." },
    outra_conta: { ok: false, text: "Abra o link conectado à mesma conta que pediu a troca de e-mail." },
    em_uso: { ok: false, text: "Este e-mail já está em uso em outra conta." },
    erro: { ok: false, text: "Não foi possível trocar o e-mail agora. Tente novamente." },
  };
  const emailNotice = params.email ? emailNotices[params.email] : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createSupabaseServiceClient() as any;
  const [identity, reputations, { data: blockRows }] = await Promise.all([getCustomerIdentity(user.id), getCustomerReputations([user.id]), service.from("UserBlock").select("blockedId, createdAt, blocked:User!UserBlock_blockedId_fkey(name)").eq("blockerId", user.id).order("createdAt", { ascending: false })]);
  const reputation = reputations.get(user.id);
  const calendarLink = staff ? null : await getCalendarLink(user.id);
  return <DashboardShell mode={user.role === Role.ADMIN ? "admin" : user.role === Role.SUPPORT ? "support" : consultantContext ? "consultant" : "user"} title={consultantContext || staff ? "Conta e segurança" : "Minha conta"} canConsultant={user.role === Role.CONSULTANT}><div className="profile-management-stack">{params.mfa === "obrigatorio" && user.role === Role.ADMIN && (mfaActive ? <p className="form-feedback" role="status">Verificação em duas etapas ativa. <Link className="text-link" href="/admin">Ir para o painel administrativo</Link></p> : <p className="form-error" role="alert">Contas de administrador precisam da verificação em duas etapas. Ative abaixo, em &quot;Verificação em duas etapas&quot;, para acessar o painel administrativo.</p>)}{consultantContext ? null : <ProfileImageForm image={stored.image} name={stored.name} seed={stored.id}/>}<div className="panel form-stack"><span className="eyebrow">Conta e segurança</span><h2>Gerencie seus dados de acesso e as informações da sua conta.</h2><AccountNameForm name={stored.name}/>{emailNotice && <p className={emailNotice.ok ? "form-feedback" : "form-error"} role={emailNotice.ok ? "status" : "alert"}>{emailNotice.text}</p>}<EmailChangeForm email={stored.email} hasPassword={hasPassword}/>{!staff && <p className="muted">Esta conta pode atuar como cliente e, quando habilitada, também como consultor.{user.role === Role.USER && <> <Link className="text-link" href="/dashboard/virar-consultor">Virar consultor</Link></>}</p>}</div>{!staff && <section className="panel form-stack"><span className="eyebrow">Identificação</span><h2>Dados para agendar conversas.</h2>{identity ? <><p>CPF <strong>{identity.maskedCpf}</strong> · {identity.age} anos</p><p className="muted">Registrado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(parseDbDate(identity.registeredAt))}. Para corrigir esses dados, fale com o suporte.</p></> : <><p className="muted">Quem agenda conversas se identifica com CPF e data de nascimento. O consultor vê só o CPF mascarado e a idade.</p><CustomerIdentityForm/></>}</section>}{!staff && <section className="panel form-stack"><span className="eyebrow">Sua reputação como cliente</span>{reputation ? <><div className="reputation"><span className="reputation-stars">★ {reputation.average.toFixed(1)}</span><span className="muted">{reputation.count} {reputation.count === 1 ? "avaliação" : "avaliações"} de consultores</span><span className={`status ${reputation.label === "Atenção" ? "reputation-bad" : "reputation-good"}`}>{reputation.label}</span></div>{reputation.recent.map((item, index) => <p className="muted" key={index}>★ {item.rating} · “{item.comment}”</p>)}</> : <p className="muted">Depois de cada conversa, o consultor pode avaliar você. As notas aparecem aqui e para os próximos consultores com quem você conversar.</p>}</section>}<ChangePasswordForm hasPassword={hasPassword}/><MfaSettings/>{process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}/>}<section className="panel form-stack" id="bloqueados"><span className="eyebrow">Pessoas bloqueadas</span><h2>Quem você bloqueou</h2><p className="muted">Pessoas bloqueadas não conseguem agendar conversas com você, nem você com elas. Ao desbloquear, vocês voltam a poder agendar.</p>{params.bloqueio === "removido" && <p className="form-feedback" role="status">Bloqueio removido.</p>}{(blockRows ?? []).length ? <div className="list">{(blockRows ?? []).map((row: { blockedId: string; createdAt: string; blocked: { name: string } | { name: string }[] | null }) => <div className="list-row" key={row.blockedId}><div><strong>{(Array.isArray(row.blocked) ? row.blocked[0]?.name : row.blocked?.name) ?? "Pessoa"}</strong><small className="muted"> · bloqueada em {shortDate(parseDbDate(row.createdAt))}</small></div><form action={unblockUserAction.bind(null, row.blockedId, consultantContext)}><button className="button button-ghost button-sm">Desbloquear</button></form></div>)}</div> : <p className="blocked-empty">Você não bloqueou ninguém. Para bloquear alguém, use “Bloquear” na conversa com a pessoa.</p>}</section>{!staff && <>{params.sync && (() => { const notice = calendarSyncText(params.sync, params.adicionadas, params.removidos); return <p className={notice.ok ? "form-feedback" : "form-error"} role={notice.ok ? "status" : "alert"}>{notice.text}</p>; })()}<GoogleCalendarPanel link={calendarLink} returnTo="/dashboard/configuracoes" consultant={user.role === Role.CONSULTANT}/></>}<section className="panel form-stack"><span className="eyebrow">Seus dados (LGPD)</span><h2>Baixe uma cópia de tudo o que guardamos sobre você.</h2><p className="muted">Cadastro, identificação, agendamentos, mensagens, avaliações, favoritos, notificações e registros de acesso, numa planilha da Insidely, com uma aba para cada tipo de dado.</p><div className="about-actions"><a className="button button-dark" href="/api/meus-dados" download>Baixar planilha (Excel)</a><a className="button button-ghost" href="/api/meus-dados?formato=json" download>Arquivo JSON, para levar a outro serviço</a></div></section><AccountDangerZone email={stored.email}/></div></DashboardShell>;
}
