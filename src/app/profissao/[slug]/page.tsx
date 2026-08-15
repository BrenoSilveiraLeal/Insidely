import { notFound } from "next/navigation";
import { ProfessionalCard } from "@/components/cards";
import { PublicShell } from "@/components/public-shell";
import { getProfessionBySlug, searchProfessionals } from "@/lib/queries";
import { getProfessionalInclude } from "@/lib/queries";
export const dynamic = "force-dynamic";
export default async function ProfessionPage({ params }: { params: Promise<{ slug: string }> }) { const {slug}=await params; const profession=await getProfessionBySlug(slug); if(!profession)notFound(); const ids=[...new Set(profession.experiences.map(x=>x.professionalProfileId))]; const profiles=await searchProfessionals({}); return <PublicShell><section className="page-hero" data-mark="P"><div className="container page-hero-inner"><span className="eyebrow">{profession.category}</span><h1>{profession.name}</h1><p>{profession.description}</p></div></section><section className="section"><div className="container">{profession.realityCheck && <LinkReality slug={slug}/>}<div className="section-head"><div><span className="eyebrow">{profiles.length} profissionais</span><h2 className="section-title">Experiências nesta profissão.</h2></div></div><div className="grid grid-4">{profiles.map((p,i)=><ProfessionalCard key={p.id} profile={p} index={i}/>)}</div></div></section></PublicShell>; }
function LinkReality({slug}:{slug:string}){return <a className="button button-dark" href={`/reality-check/${slug}`} style={{marginBottom:36}}>Abrir Reality Check</a>}
