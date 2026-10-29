import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { Role } from "@/lib/domain";
import { parseDbDate } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAdminData } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser([Role.ADMIN]);
  const data = await getAdminData();
  // The suspension columns are added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: suspendedRows } = await (createSupabaseServiceClient() as any).from("User").select("id, suspendedUntil").not("suspendedAt", "is", null);
  const suspended = new Set<string>((suspendedRows ?? []).filter((row: { suspendedUntil: string | null }) => !row.suspendedUntil || parseDbDate(row.suspendedUntil) > new Date()).map((row: { id: string }) => row.id));
  return <DashboardShell mode="admin" title="Usuários"><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Onboarding</th><th>MFA</th><th>Cadastro</th></tr></thead><tbody>{data.usersList.map((user) => <tr key={user.id}><td><Link className="text-link" href={`/admin/usuarios/${user.id}`}>{user.name}</Link>{suspended.has(user.id) && <> <span className="status">Suspensa</span></>}</td><td>{user.email}</td><td><span className="status">{user.role}</span></td><td>{user.onboardingCompleted ? "Concluído" : "Pendente"}</td><td>{user.twoFactorEnabled ? "Ativo" : "Não"}</td><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(parseDbDate(user.createdAt))}</td></tr>)}</tbody></table>{!data.usersList.length && <p className="muted">Nenhum usuário encontrado.</p>}</div></DashboardShell>;
}
