import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Advertências e suspensões" };
export const dynamic = "force-dynamic";

type Row = { id: string; name: string; email: string; role: string; suspendedAt: string | null; suspendedUntil: string | null };

// Where support staff find an account to warn, suspend or ban. Only by name or e-mail (never CPF),
// and admin and support accounts are not listed.
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireUser([Role.ADMIN, Role.SUPPORT]);
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  let rows: Row[] = [];
  if (q.length >= 3) {
    const term = q.replace(/[%,()]/g, " ");
    const { data } = await supabase.from("User").select("id, name, email, role, suspendedAt, suspendedUntil").in("role", ["USER", "CONSULTANT"]).not("email", "like", "deleted+%").not("email", "like", "merged+%").or(`name.ilike.%${term}%,email.ilike.%${term}%`).order("name").limit(25);
    rows = (data ?? []) as Row[];
  }
  const isSuspended = (row: Row) => Boolean(row.suspendedAt) && (!row.suspendedUntil || parseDbDate(row.suspendedUntil) > new Date());
  return <DashboardShell mode={staff.role === Role.ADMIN ? "admin" : "support"} title="Advertências e suspensões">
    <section className="panel form-stack">
      <p className="muted">A cada 3 advertências a conta é suspensa: 7 dias na 1ª vez, 1 mês na 2ª; depois de mais 3 advertências, é banida. O histórico só é visto pelo suporte e pela administração.</p>
      <form className="admin-search" role="search"><input className="input" name="q" defaultValue={q} placeholder="Nome ou e-mail (mínimo 3 letras)" aria-label="Buscar conta"/><button className="button button-dark button-sm">Buscar</button>{q && <Link className="text-link" href="/admin/sancoes">Limpar</Link>}</form>
    </section>
    {q.length >= 3 && <div className="list">{rows.map((row) => <div className="list-row" key={row.id}><p><Link className="text-link" href={`/admin/sancoes/${row.id}`}>{row.name}</Link> · {row.email} {isSuspended(row) && <span className="status">Suspensa</span>}</p><span className="muted">{row.role === "CONSULTANT" ? "Consultor" : "Cliente"}</span></div>)}{!rows.length && <p className="muted">Nenhuma conta encontrada.</p>}</div>}
  </DashboardShell>;
}
