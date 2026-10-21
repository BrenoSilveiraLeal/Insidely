import { getUserById } from "@/lib/queries";
import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { AccountDangerZone } from "@/components/profile-management";
import { ChangePasswordForm } from "@/components/auth-form";
import { ProfileImageForm } from "@/components/profile-image-form";
import { AccountNameForm } from "@/components/account-name-form";
import { MfaSettings } from "@/components/mfa-settings";
import { EmailChangeForm } from "@/components/email-change-form";
import { requireUser } from "@/lib/session";
import { accountHasPassword } from "@/lib/auth-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Minha conta" };
export default async function Page({ searchParams }: { searchParams: Promise<{ context?: string; email?: string }> }) {
  const params = await searchParams;
  const user = await requireUser([Role.USER, Role.CONSULTANT, Role.ADMIN]);
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
  return <DashboardShell mode={consultantContext ? "consultant" : "user"} title={consultantContext ? "Conta e segurança" : "Minha conta"} canConsultant={user.role === Role.CONSULTANT}><div className="profile-management-stack"><ProfileImageForm image={stored.image} name={stored.name}/><div className="panel form-stack"><span className="eyebrow">Conta e segurança</span><h2>Gerencie seus dados de acesso e as informações da sua conta.</h2><AccountNameForm name={stored.name}/>{emailNotice && <p className={emailNotice.ok ? "form-feedback" : "form-error"} role={emailNotice.ok ? "status" : "alert"}>{emailNotice.text}</p>}<EmailChangeForm email={stored.email} hasPassword={hasPassword}/><p className="muted">Esta conta pode atuar como cliente e, quando habilitada, também como consultor.</p></div><ChangePasswordForm hasPassword={hasPassword}/><MfaSettings/><AccountDangerZone email={stored.email}/></div></DashboardShell>;
}
