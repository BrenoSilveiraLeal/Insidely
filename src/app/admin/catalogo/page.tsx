import Link from "next/link";
import { resolveCatalogRequestAction } from "@/app/actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { Role } from "@/lib/domain";
import { parseDbDate, shortDate } from "@/lib/format";
import { getPublicCompanies, getPublicProfessions } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { paginate } from "@/lib/paginate";
import { PaginationControls } from "@/components/pagination-controls";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Empresas e áreas" };
export const dynamic = "force-dynamic";

type Request = { kind: "COMPANY" | "PROFESSION"; name: string; normalizedName: string; userId: string; createdAt: string };

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; tipo?: string; page?: string }> }) {
  const staff = await requireUser([Role.ADMIN, Role.SUPPORT]);
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
  const pendingCompanies = [...groups.values()].filter((group) => group.kind === "COMPANY").length;
  const pendingProfessions = groups.size - pendingCompanies;
  // Two tabs: companies or areas. Without a choice, open the one that has requests (companies first).
  const tab: Request["kind"] = query.tipo === "areas" ? "PROFESSION" : query.tipo === "empresas" ? "COMPANY" : pendingCompanies || !pendingProfessions ? "COMPANY" : "PROFESSION";
  const shown = paginate([...groups.values()].filter((group) => group.kind === tab), query.page, 20);
  const visible = shown.items;
  return <DashboardShell mode={staff.role === Role.ADMIN ? "admin" : "support"} title="Empresas e áreas">
    {query.ok && <p className="form-feedback" role="status">{query.ok === "aprovado" ? "Pedido aprovado. Os perfis que aguardavam já foram atualizados e os consultores, avisados." : "Pedido recusado. Os consultores foram avisados."}</p>}
    {query.erro && <p className="form-error" role="alert">{query.erro}</p>}
    <div className="catalog-admin">
      <nav className="catalog-counters catalog-tabs" aria-label="Tipo de pedido">
        <Link className={`metric catalog-tab${tab === "COMPANY" ? " is-active" : ""}`} href="/admin/catalogo?tipo=empresas" aria-current={tab === "COMPANY" ? "page" : undefined}><span>Empresas aguardando</span><strong>{pendingCompanies}</strong></Link>
        <Link className={`metric catalog-tab${tab === "PROFESSION" ? " is-active" : ""}`} href="/admin/catalogo?tipo=areas" aria-current={tab === "PROFESSION" ? "page" : undefined}><span>Áreas aguardando</span><strong>{pendingProfessions}</strong></Link>
      </nav>
      {visible.map((group) => {
        const company = group.kind === "COMPANY";
        const options = company ? companies : professions;
        const hidden = <><input type="hidden" name="kind" value={group.kind}/><input type="hidden" name="key" value={group.key}/></>;
        return <article className="panel catalog-request" key={`${group.kind}:${group.key}`}>
          <header className="catalog-request-head">
            <div><span className="eyebrow">{company ? "Empresa" : "Área de atuação"}</span><h2>{group.names[0]}</h2>{group.names.length > 1 && <p className="muted">Também escrito como: {group.names.slice(1).join(", ")}</p>}</div>
            <span className="status">{group.count} {group.count === 1 ? "pedido" : "pedidos"} · desde {shortDate(parseDbDate(group.since))}</span>
          </header>
          <div className="catalog-actions">
            <form action={resolveCatalogRequestAction} className="catalog-action">
              {hidden}<input type="hidden" name="decision" value="new"/>
              <strong>Adicionar como novo item</strong>
              <label className="field"><span>Nome no catálogo</span><input className="input" name="name" defaultValue={group.names[0]} required minLength={2} maxLength={80}/></label>
              <label className="field"><span>{company ? "Setor" : "Categoria"}</span><input className="input" name="group" placeholder={company ? "Ex.: Tecnologia" : "Ex.: Engenharia"}/></label>
              <button className="button button-accent button-sm" type="submit">Adicionar ao catálogo</button>
            </form>
            <form action={resolveCatalogRequestAction} className="catalog-action">
              {hidden}<input type="hidden" name="decision" value="existing"/>
              <strong>Já existe com outro nome?</strong>
              <label className="field"><span>{company ? "Empresa" : "Área"} existente</span><select className="select" name="existingId" required defaultValue=""><option value="" disabled>Selecione</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
              <button className="button button-dark button-sm" type="submit">Vincular à existente</button>
            </form>
            <form action={resolveCatalogRequestAction} className="catalog-action catalog-action-reject">
              {hidden}<input type="hidden" name="decision" value="reject"/>
              <strong>Não faz sentido adicionar?</strong>
              <p className="muted">O perfil continua como “{company ? "Empresa" : "Área"} não cadastrada” e o consultor é avisado.</p>
              <button className="button button-ghost button-sm" type="submit">Recusar pedido</button>
            </form>
          </div>
        </article>;
      })}
      <PaginationControls page={shown.page} total={shown.total} pageSize={shown.pageSize} basePath={`/admin/catalogo?tipo=${tab === "COMPANY" ? "empresas" : "areas"}`}/>
      {!visible.length && <section className="panel catalog-empty"><span className="catalog-empty-icon" aria-hidden="true">✓</span><h2>Fila vazia</h2><p className="muted">Nenhuma {tab === "COMPANY" ? "empresa" : "área"} aguardando análise. Novos pedidos aparecem aqui e chegam como notificação.</p></section>}
    </div>
  </DashboardShell>;
}
