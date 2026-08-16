import { PublicShell } from "@/components/public-shell";
import { getRealityCheckBySlug } from "@/lib/queries";
import { notFound } from "next/navigation";

const routineLabels: Record<string,string> = { foco: "Foco", revisao: "Revisão", revisão: "Revisão", suporte: "Suporte", reunioes: "Reuniões", reuniões: "Reuniões", atendimento: "Atendimento", planejamento: "Planejamento" };
const labelRoutine = (value: string) => routineLabels[value.toLowerCase()] ?? value.replace(/_/g, " ").replace(/^./, char => char.toUpperCase());

export default async function RealityDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getRealityCheckBySlug(slug);
  if (!item) notFound();
  const routine = item.routine as Record<string, number>;
  return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Reality Check · {item.profession.category}</span><h1>{item.profession.name}</h1><p>{item.intro}</p></div></section><section className="section"><div className="container grid grid-2"><div className="panel"><span className="eyebrow">O imaginado</span><h2 className="section-title" style={{fontSize:"3.4rem"}}>Antes de entrar.</h2><ul className="detail-list">{item.imagined.map(value=><li key={value}>{value}<span>→</span></li>)}</ul></div><div className="panel" style={{background:"var(--mineral)"}}><span className="eyebrow">Na prática</span><h2 className="section-title" style={{fontSize:"3.4rem"}}>O contexto pesa.</h2><ul className="detail-list">{item.practical.map(value=><li key={value}>{value}<span>→</span></li>)}</ul></div><div className="panel" style={{gridColumn:"1 / -1"}}><span className="eyebrow">Distribuição ilustrativa da rotina</span><div className="grid grid-4" style={{marginTop:24}}>{Object.entries(routine).map(([key,value])=><div className="metric" key={key}><span>{labelRoutine(key)}</span><strong>{value}%</strong></div>)}</div><p className="muted">Os percentuais são um exemplo editorial do seed, não uma pesquisa estatística.</p></div></div></section></PublicShell>;
}
