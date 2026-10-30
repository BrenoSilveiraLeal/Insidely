import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { Role } from "@/lib/domain";
import { parseDbDate } from "@/lib/format";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

type Row = { id: string; name: string; email: string; role: string; onboardingCompleted: boolean; createdAt: string; suspendedAt: string | null; suspendedUntil: string | null };

// Search by name, e-mail or CPF (digits). The CPF is only matched, never shown here.
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string }> }) {
  await requireUser([Role.ADMIN]);
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  // Suspension columns and CustomerIdentity are added by migrations beyond the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  let query = supabase.from("User").select("id, name, email, role, onboardingCompleted, createdAt, suspendedAt, suspendedUntil").not("email", "like", "deleted+%").not("email", "like", "merged+%").order("createdAt", { ascending: false }).limit(200);
  const digits = q.replace(/\D/g, "");
  if (q && digits.length === 11) {
    const { data: identity } = await supabase.from("CustomerIdentity").select("userId").eq("cpf", digits).maybeSingle();
    query = query.eq("id", identity?.userId ?? "-");
  } else if (q) {
    const term = q.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data } = await query;
  const rows = (data ?? []) as Row[];
  const isSuspended = (row: Row) => Boolean(row.suspendedAt) && (!row.suspendedUntil || parseDbDate(row.suspendedUntil) > new Date());
  return <DashboardShell mode="admin" title="Usuários">
    <form className="admin-search" role="search"><input className="input" name="q" defaultValue={q} placeholder="Buscar por nome, e-mail ou CPF" aria-label="Buscar usuários"/><button className="button button-dark button-sm">Buscar</button>{q && <Link className="text-link" href="/admin/usuarios">Limpar</Link>}</form>
    {params.ok === "excluida" && <p className="form-feedback" role="status">Conta excluída. A ação ficou no registro.</p>}
    <p className="muted">{rows.length} {rows.length === 1 ? "conta" : "contas"}{q ? ` para “${q}”` : ""}{rows.length === 200 ? " (mostrando as 200 mais recentes)" : ""}.</p>
    <div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Cadastro</th><th>Criada em</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{rows.map((user) => <tr key={user.id}><td><Link className="text-link" href={`/admin/usuarios/${user.id}`}>{user.name}</Link>{isSuspended(user) && <> <span className="status">Suspensa</span></>}</td><td>{user.email}</td><td><span className="status">{user.role}</span></td><td>{user.onboardingCompleted ? "Concluído" : "Pendente"}</td><td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(parseDbDate(user.createdAt))}</td><td className="row-menu-cell"><details className="row-menu"><summary aria-label={`Ações para ${user.name}`}><MoreHorizontal size={18} aria-hidden="true"/></summary><div className="row-menu-list"><Link href={`/admin/usuarios/${user.id}`}>Ver conta</Link>{user.role !== "ADMIN" && <>{isSuspended(user) ? <Link href={`/admin/usuarios/${user.id}#suspensao`}>Encerrar suspensão</Link> : <><Link href={`/admin/usuarios/${user.id}#suspensao`}>Suspender…</Link><Link href={`/admin/usuarios/${user.id}?acao=banir#suspensao`}>Banir…</Link></>}<Link href={`/admin/usuarios/${user.id}#notas`}>Adicionar nota</Link><Link className="row-menu-danger" href={`/admin/usuarios/${user.id}#excluir`}>Excluir conta…</Link></>}</div></details></td></tr>)}</tbody></table>{!rows.length && <p className="muted">Nenhum usuário encontrado.</p>}</div>
  </DashboardShell>;
}
