import { Role } from "@/lib/domain";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page() { await requireUser([Role.ADMIN]); return <DashboardShell mode="admin" title="Usuários"><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Perfil</th></tr></thead><tbody /></table></div></DashboardShell>; }
