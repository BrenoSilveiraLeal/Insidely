import { getUserById } from "@/lib/queries";
import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { AccountDangerZone, ProfileImageForm } from "@/components/profile-management";
import { requireUser } from "@/lib/session";

export default async function Page() { const user = await requireUser([Role.USER, Role.ADMIN]); const stored = await getUserById(user.id); if (!stored) return null; return <DashboardShell mode="user" title="Minha conta"><div className="profile-management-stack"><ProfileImageForm image={stored.image} name={stored.name}/><div className="panel form-stack"><span className="eyebrow">Conta de quem explora</span><h2>Seus dados para entrar, agendar e acompanhar conversas.</h2><div className="field"><label>Nome</label><input className="input" value={stored.name} readOnly/></div><div className="field"><label>E-mail</label><input className="input" value={stored.email} readOnly/></div><p className="muted">Esta conta n ? um perfil p de consultor. Perfis profissionais possuem experi, verifica, valor e regras prs.</p></div><AccountDangerZone email={stored.email}/></div></DashboardShell>; }
