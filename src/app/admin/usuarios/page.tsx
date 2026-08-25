import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  return <DashboardShell mode="admin" title="Usuários"><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Onboarding</th><th>MFA</th><th>Cadastro</th></tr></thead><tbody>{data.usersList.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td><span className="status">{user.role}</span></td><td>{user.onboardingCompleted ? "Concluído" : "Pendente"}</td><td>{user.twoFactorEnabled ? "Ativo" : "Não"}</td><td>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</td></tr>)}</tbody></table>{!data.usersList.length && <p className="muted">Nenhum usuário encontrado.</p>}</div></DashboardShell>;
}
