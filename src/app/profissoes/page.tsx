import { PublicShell } from "@/components/public-shell";
import { ProfessionCard } from "@/components/cards";
import { getPublicProfessionsPage } from "@/lib/queries";

export default async function ProfessionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const result = await getPublicProfessionsPage(page);
  return <PublicShell><section className="page-hero" data-mark="P"><div className="container page-hero-inner"><span className="eyebrow">Profissões</span><h1>O cargo não conta o dia.</h1><p>Descubra como a rotina muda por contexto, senioridade, empresa e forma de trabalho.</p></div></section><section className="section"><div className="container"><div className="grid grid-3">{result.items.map(profession=><ProfessionCard key={profession.id} profession={profession}/>)}</div><div className="pagination"><span>{result.total} profissões · página {result.page}</span>{page > 1 && <a className="button button-ghost" href={`/profissoes?page=${page - 1}`}>Anterior</a>}{page * result.pageSize < result.total && <a className="button button-dark" href={`/profissoes?page=${page + 1}`}>Próxima</a>}</div></div></section></PublicShell>;
}
