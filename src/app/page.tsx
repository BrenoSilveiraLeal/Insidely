import Link from "next/link";
import { ArrowDown, ArrowRight, ShieldCheck } from "lucide-react";
import { CompanyCard, ProfessionalCard, ProfessionCard } from "@/components/cards";
import { PublicShell } from "@/components/public-shell";
import { getHomeData } from "@/lib/queries";
import { StoryMotion } from "@/components/story-motion";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getHomeData();
  return <PublicShell>
    <section className="hero"><div className="hero-ring">?</div><div className="container hero-inner"><span className="eyebrow">Carreira com contexto, não com promessa</span><h1>A realidade <span>antes</span> da decisão.</h1><div className="hero-bottom"><p className="hero-copy">Converse com quem vive a rotina de empresas e profissões. Pergunte o que a vaga, o curso e a marca não conseguem responder.</p><div className="hero-actions"><Link className="button button-accent" href="/buscar">Encontrar alguém <ArrowRight size={17}/></Link><Link className="button button-ghost" href="#como-funciona">Entender como funciona <ArrowDown size={17}/></Link></div></div></div></section>
    <section className="stat-strip"><div className="container stats"><div className="stat"><strong>{data.professionalCount}</strong><span>profissionais ativos</span></div><div className="stat"><strong>{data.companyCount}</strong><span>empresas representadas</span></div><div className="stat"><strong>{data.completedCount}</strong><span>conversas concluídas</span></div><div className="stat"><strong>{data.rating.toFixed(1)}</strong><span>avaliação média real</span></div></div></section>
    <StoryMotion/>
    <section className="section"><div className="container"><div className="section-head"><div><span className="eyebrow">Pessoas, não rankings</span><h2 className="section-title">Experiências para comparar.</h2></div><Link className="button button-dark" href="/buscar">Ver todos <ArrowRight size={16}/></Link></div><div className="grid grid-4">{data.professionals.map((profile, index) => <ProfessionalCard key={profile.id} profile={profile} index={index}/>)}</div></div></section>
    <section className="section" style={{ background: "var(--paper-2)" }}><div className="container"><div className="section-head"><div><span className="eyebrow">Contexto de empresa</span><h2 className="section-title">A mesma marca tem muitas realidades.</h2></div><Link className="button button-dark" href="/empresas">Todas as empresas</Link></div><div className="grid grid-4">{data.companies.slice(0,8).map((company) => <CompanyCard key={company.id} company={company}/>)}</div></div></section>
    <section className="section"><div className="container"><div className="section-head"><div><span className="eyebrow">Reality Check</span><h2 className="section-title">O trabalho imaginado encontra o trabalho prático.</h2></div></div><div className="grid grid-3">{data.professions.slice(0,6).map((profession) => <ProfessionCard key={profession.id} profession={profession}/>)}</div></div></section>
    <section className="section" style={{ background: "var(--amber)" }}><div className="container grid grid-2"><div><span className="eyebrow">Confiança desde o desenho</span><h2 className="section-title">Privacidade não é um botão tardio.</h2></div><div><p className="section-copy">Consultores controlam nome, foto, cidade, datas e histórico. Verificações são privadas; o perfil público exibe apenas o selo.</p><p><ShieldCheck/> Nenhuma conversa autoriza compartilhar segredos, documentos internos ou dados de terceiros.</p><Link className="button button-dark" href="/cadastro">Participar com segurança</Link></div></div></section>
  </PublicShell>;
}
