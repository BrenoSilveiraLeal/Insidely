import Link from "next/link";
import { Search } from "lucide-react";
import { ProfessionalCard } from "@/components/cards";
import { PublicShell } from "@/components/public-shell";
import { getPublicCompanies, getPublicProfessions, searchProfessionals } from "@/lib/queries";

export const dynamic = "force-dynamic";
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams; const [profiles, companies, professions] = await Promise.all([searchProfessionals(params), getPublicCompanies(), getPublicProfessions()]);
  return <PublicShell><section className="page-hero" data-mark="?"><div className="container page-hero-inner"><span className="eyebrow">Busca contextual</span><h1>Encontre quem vive a realidade.</h1><p>Use filtros para chegar a conversas relevantes. Resultados e contadores v?m do banco de dados.</p></div></section><div className="container"><form className="search-panel">
    <div className="field"><label htmlFor="q">Palavra-chave</label><input className="input" id="q" name="q" defaultValue={params.q} placeholder="Cargo, cidade ou tema"/></div>
    <div className="field"><label htmlFor="company">Empresa</label><select className="select" id="company" name="company" defaultValue={params.company}><option value="">Todas</option>{companies.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></div>
    <div className="field"><label htmlFor="profession">Profiss</label><select className="select" id="profession" name="profession" defaultValue={params.profession}><option value="">Todas</option>{professions.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></div>
    <button className="button button-dark" type="submit"><Search size={16}/>Buscar</button>
  </form></div><section className="section"><div className="container"><div className="section-head"><div><span className="eyebrow">{profiles.length} resultados</span><h2 className="section-title">Compare experis, n personagens.</h2></div>{Object.values(params).some(Boolean) && <Link className="button button-ghost" href="/buscar">Limpar filtros</Link>}</div>{profiles.length ? <div className="grid grid-4">{profiles.map((profile,index)=><ProfessionalCard key={profile.id} profile={profile} index={index}/>)}</div> : <div className="panel"><h3>Nenhum perfil com estes filtros.</h3><p className="muted">Remova um filtro ou pesquise por um termo mais amplo.</p></div>}</div></section></PublicShell>;
}

