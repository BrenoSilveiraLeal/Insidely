import { notFound } from "next/navigation";
import { ProfessionalCard } from "@/components/cards";
import { PublicShell } from "@/components/public-shell";
import { getCompanyBySlug, searchProfessionals } from "@/lib/queries";
export const dynamic = "force-dynamic";
export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) { const {slug}=await params; const company=await getCompanyBySlug(slug); if(!company)notFound(); const profiles=await searchProfessionals({}); return <PublicShell><section className="page-hero" data-mark={company.logoText}><div className="container page-hero-inner"><span className="eyebrow">{company.sector}</span><h1>{company.name}</h1><p>{company.description}</p></div></section><section className="section"><div className="container"><div className="section-head"><div><span className="eyebrow">{profiles.length} experiências</span><h2 className="section-title">Converse com quem conhece o contexto.</h2></div></div><div className="grid grid-4">{profiles.map((p,i)=><ProfessionalCard key={p.id} profile={p} index={i}/>)}</div></div></section></PublicShell>; }
