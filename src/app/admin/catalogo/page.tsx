import { resolveCatalogRequestAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { getPublicCompanies, getPublicProfessions } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Empresas e áreas" };
export const dynamic = "force-dynamic";

type Request = { kind: "COMPANY" | "PROFESSION"; name: string; normalizedName: string; userId: string; createdAt: string };

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireUser([Role.ADMIN]);
  const query = await searchParams;
  // CatalogRequest is added by a migration beyond the generated legacy types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const [{ data }, companies, professions] = await Promise.all([
    supabase.from("CatalogRequest").select("kind, name, normalizedName, userId, createdAt").eq("status", "PENDING").order("createdAt"),
    getPublicCompanies(), getPublicProfessions(),
  ]);
  // Same name typed by several consultants is one decision.
  const groups = new Map<string, { kind: Request["kind"]; key: string; names: string[]; count: number; since: string }>();
  for (const item of (data ?? []) as Request[]) {
    const id = `${item.kind}:${item.normalizedName}`;
    const group = groups.get(id) ?? { kind: item.kind, key: item.normalizedName, names: [], count: 0, since: item.createdAt };
    if (!group.names.includes(item.name)) group.names.push(item.name);
    group.count++;
    groups.set(id, group);
  }
  return <DashboardShell mode="admin" title="Empresas e áreas">
    {query.ok && <p className="form-feedback" role="status">{query.ok === "aprovado" ? "Pedido aprovado. Os perfis que aguardavam já foram atualizados e os consultores, avisados." : "Pedido recusado. Os consultores foram avisados."}</p>}
    {query.erro && <p className="form-error" role="alert">{query.erro}</p>}
    <p className="muted">Empresas e áreas digitadas como “Outra” no cadastro de consultores. Enquanto o pedido não é analisado, o perfil mostra “Empresa não cadastrada” ou “Área não cadastrada” e funciona normalmente.</p>
    <div className="list">{[...groups.values()].map((group) => {
      const company = group.kind === "COMPANY";
      const options = company ? companies : professions;
      return <article className="panel catalog-request" key={`${group.kind}:${group.key}`}>
        <span className="eyebrow">{company ? "Empresa" : "Área de atuação"} · {group.count} {group.count === 1 ? "pedido" : "pedidos"} · desde {shortDate(parseDbDate(group.since))}</span>
        <h2>{group.names[0]}</h2>
        {group.names.length > 1 && <p className="muted">Também escrito como: {group.names.slice(1).join(", ")}</p>}
        <form action={resolveCatalogRequestAction} className="profile-form-grid">
          <input type="hidden" name="kind" value={group.kind}/><input type="hidden" name="key" value={group.key}/><input type="hidden" name="decision" value="new"/>
          <label>Nome no catálogo<input className="input" name="name" defaultValue={group.names[0]} required minLength={2} maxLength={80}/></label>
          <label>{company ? "Setor" : "Categoria"}<input className="input" name="group" placeholder={company ? "Ex.: Tecnologia" : "Ex.: Engenharia"}/></label>
          <button className="button button-accent button-sm" type="submit">Adicionar ao catálogo</button>
        </form>
        <form action={resolveCatalogRequestAction} className="profile-form-grid">
          <input type="hidden" name="kind" value={group.kind}/><input type="hidden" name="key" value={group.key}/><input type="hidden" name="decision" value="existing"/>
          <label>Já existe com outro nome?<select className="select" name="existingId" required defaultValue=""><option value="" disabled>Selecione</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
          <button className="button button-dark button-sm" type="submit">Vincular à existente</button>
        </form>
        <form action={resolveCatalogRequestAction}><input type="hidden" name="kind" value={group.kind}/><input type="hidden" name="key" value={group.key}/><input type="hidden" name="decision" value="reject"/><button className="button button-ghost button-sm" type="submit">Recusar</button></form>
      </article>;
    })}{!groups.size && <div className="panel"><h2>Fila vazia</h2><p className="muted">Nenhuma empresa ou área aguardando análise.</p></div>}</div>
  </DashboardShell>;
}
