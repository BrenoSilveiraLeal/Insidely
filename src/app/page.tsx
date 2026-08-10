import Link from "next/link";
import { ArrowRight, Building2, Eye, Fingerprint, IdCard, LockKeyhole, MessageCircleMore, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { CompanyCard, ProfessionalCard, ProfessionCard } from "@/components/cards";
import { InsideHero } from "@/components/inside-hero";
import { PublicShell } from "@/components/public-shell";
import { StoryMotion } from "@/components/story-motion";
import { getHomeData } from "@/lib/queries";

export const dynamic = "force-dynamic";

const realQuestions = [
  ["ambiente dinâmico", "As prioridades mudam toda semana?"],
  ["muita autonomia", "Quem dá contexto quando você trava?"],
  ["cultura forte", "Discordar é seguro dentro do time?"],
  ["crescimento rápido", "Existe mentoria ou só cobrança?"],
  ["perfil flexível", "Existe desvio de função na prática?"],
];

export default async function Home() {
  const data = await getHomeData();
  return <PublicShell>
    <InsideHero/>
    <section className="stat-strip" aria-label="Números da comunidade"><div className="container stats"><div className="stat"><strong>{data.professionalCount}</strong><span>profissionais ativos</span></div><div className="stat"><strong>{data.companyCount}</strong><span>empresas representadas</span></div><div className="stat"><strong>{data.completedCount}</strong><span>conversas concluídas</span></div><div className="stat"><strong>{data.rating.toFixed(1)}</strong><span>avaliação média real</span></div></div></section>

    <section className="truth-section"><div className="container truth-grid"><div className="truth-heading"><span className="eyebrow">Toda vaga deixa coisas de fora</span><h2>Palavras bonitas.<br/><span>Perguntas reais.</span></h2><p>Descrição de cargo, página de carreira e entrevista contam a versão oficial. Uma decisão importante também precisa do contexto que só aparece numa conversa.</p></div><div className="truth-list">{realQuestions.map(([claim, question], index)=><article key={claim}><span>{String(index+1).padStart(2,"0")}</span><div><s>{claim}</s><h3>{question}</h3></div><Eye size={22}/></article>)}</div></div></section>

    <StoryMotion/>

    <section className="section people-section"><div className="container"><div className="section-head"><div><span className="eyebrow">Pessoas, não rankings</span><h2 className="section-title">Experiências para comparar.</h2></div><Link className="text-link" href="/buscar">Ver todos os profissionais <ArrowRight size={16}/></Link></div><div className="grid grid-4">{data.professionals.map((profile,index)=><ProfessionalCard key={profile.id} profile={profile} index={index}/>)}</div></div></section>

    <section className="brand-truth-section"><div className="container brand-truth-inner"><span className="eyebrow">Uma marca não é uma experiência única</span><blockquote>A empresa que você imagina pode não ser a equipe que você encontra.</blockquote><Link className="button button-dark" href="/empresas">Ver empresas por dentro <Building2 size={17}/></Link><span className="orbit-tag orbit-team">Time</span><span className="orbit-tag orbit-routine">Rotina</span><span className="orbit-tag orbit-management">Gestão</span><span className="orbit-tag orbit-company">Empresa</span></div></section>

    <section className="section company-section"><div className="container"><div className="section-head"><div><span className="eyebrow"><Building2 size={14}/> Por dentro das empresas</span><h2 className="section-title">A mesma marca.<br/>Muitas realidades.</h2></div><Link className="text-link" href="/empresas">Todas as empresas <ArrowRight size={16}/></Link></div><div className="grid grid-4">{data.companies.slice(0,8).map(company=><CompanyCard key={company.id} company={company}/>)}</div></div></section>

    <section className="section profession-section"><div className="container"><div className="section-head"><div><span className="eyebrow"><Eye size={14}/> Reality Check</span><h2 className="section-title">A profissão imaginada encontra o trabalho prático.</h2></div><Link className="text-link" href="/profissoes">Ver todas <ArrowRight size={16}/></Link></div><div className="grid grid-3">{data.professions.slice(0,6).map(profession=><ProfessionCard key={profession.id} profession={profession}/>)}</div></div></section>

    <section className="trust-section"><div className="container trust-grid"><div><span className="eyebrow"><ShieldCheck size={14}/> Confiança desde o desenho</span><h2>Privacidade não entra depois. Ela começa junto.</h2><p>Quem compartilha experiência controla o que fica público. Verificações são privadas; o perfil exibe apenas o selo.</p><Link className="button button-light" href="/cadastro">Participar com segurança <ArrowRight size={17}/></Link></div><div className="trust-cards"><article className="trust-card trust-card-blue"><Fingerprint size={44}/><div><span>Identidade</span><h3>Pública, protegida ou pseudônima.</h3></div></article><article className="trust-card trust-card-yellow"><ShieldCheck size={44}/><div><span>Verificação</span><h3>Documento nunca aparece no perfil.</h3></div></article><article className="trust-card trust-card-pink"><LockKeyhole size={44}/><div><span>Limites</span><h3>Sem segredos, dados internos ou de terceiros.</h3></div></article></div></div></section>

    <section className="reviews-section"><div className="container reviews-grid"><Quote className="quote-mark" size={72}/><div><span className="eyebrow">Depois da conversa</span><blockquote>A conversa trouxe clareza para transformar uma dúvida em uma decisão melhor.</blockquote><p>Pessoa da comunidade · avaliação média de {data.rating.toFixed(1)}</p></div></div></section>

    <section className="final-cta"><div className="container final-cta-inner"><div className="final-copy"><span className="eyebrow">Antes da próxima decisão</span><h2>Não escolha<br/>no escuro.</h2><p>Uma conversa pode não decidir por você. Mas pode fazer você decidir melhor.</p><div><Link className="button button-accent" href="/buscar">Encontrar uma experiência <ArrowRight size={17}/></Link><Link className="button button-ghost" href="/cadastro"><MessageCircleMore size={17}/> Compartilhar a minha</Link></div></div><div className="final-symbol"><Sparkles size={120}/><IdCard size={42}/></div></div></section>
  </PublicShell>;
}
