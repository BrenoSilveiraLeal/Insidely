"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

type PanelName = "profissionais" | "empresas" | "profissoes" | "reality" | null;
type ActivePanel = { name: Exclude<PanelName, null>; path: string } | null;

const panels = {
  profissionais: { label: "Profissionais", eyebrow: "Conversas com contexto", description: "Encontre pessoas verificadas por empresa, área e experiência para fazer perguntas que importam.", allHref: "/buscar", allLabel: "Explorar todos os profissionais", items: [["/buscar?mode=REMOTE", "Trabalho remoto", "Rotina, autonomia e comunicação"], ["/buscar?mode=HYBRID", "Trabalho híbrido", "Cultura, encontros e flexibilidade"], ["/buscar?mode=ONSITE", "Trabalho presencial", "Ambiente, liderança e operação"]] },
  empresas: { label: "Empresas", eyebrow: "Ambientes de trabalho", description: "Veja a mesma empresa por diferentes áreas, níveis e momentos de carreira.", allHref: "/empresas", allLabel: "Explorar todas as empresas", items: [["/empresa/amazon", "Amazon", "Tecnologia e varejo"], ["/empresa/nubank", "Nubank", "Serviços financeiros"], ["/empresa/mercado-livre", "Mercado Livre", "Tecnologia e comércio"]] },
  profissoes: { label: "Profissões", eyebrow: "Rotinas por área", description: "Compare a ideia que você tem da profissão com a prática de quem já está nela.", allHref: "/profissoes", allLabel: "Explorar todas as profissões", items: [["/profissao/desenvolvimento-de-software", "Software", "Produto, código e carreira"], ["/profissao/dados", "Dados", "Análise, ciência e decisões"], ["/profissao/ux-ui", "UX/UI", "Pesquisa, interface e produto"]] },
  reality: { label: "Reality Check", eyebrow: "Expectativa × realidade", description: "Um ponto de partida para investigar o que não aparece na descrição da vaga.", allHref: "/reality-check", allLabel: "Ver todos os Reality Checks", items: [["/reality-check/desenvolvimento-de-software", "Software", "O trabalho além do código"], ["/reality-check/enfermagem", "Enfermagem", "Cuidado, plantão e rotina"], ["/reality-check/vendas", "Vendas", "Meta, relacionamento e pressão"]] },
} as const;

function jumpToTop() { const root = document.documentElement; const previousBehavior = root.style.scrollBehavior; root.style.scrollBehavior = "auto"; window.scrollTo({ top: 0, left: 0 }); window.requestAnimationFrame(() => { root.style.scrollBehavior = previousBehavior; }); }

export function PremiumNavigation({ dashboardHref }: { dashboardHref: string | null }) {
  const pathname = usePathname(); const router = useRouter(); const [activePanel, setActivePanel] = useState<ActivePanel>(null); const [mobilePath, setMobilePath] = useState<string | null>(null);
  const activeName = activePanel?.path === pathname ? activePanel.name : null; const mobileOpen = mobilePath === pathname;
  useEffect(() => { jumpToTop(); const timeout = window.setTimeout(() => { setActivePanel(null); setMobilePath(null); }, 0); return () => window.clearTimeout(timeout); }, [pathname]);
  useEffect(() => {
    // Depois da primeira pintura, deixa as rotas mais usadas prontas no cache
    // do roteador. Assim o clique não começa uma navegação do zero.
    const timeout = window.setTimeout(() => {
      ["/buscar", "/empresas", "/profissoes", "/reality-check"].forEach((href) => router.prefetch(href));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [router]);
  const goHome = (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); setActivePanel(null); setMobilePath(null); if (pathname === "/") { window.history.replaceState(null, "", "/#inicio"); jumpToTop(); return; } router.push("/#inicio"); };
  return <div className="header-wrap"><header className="header premium-header" aria-label="Navegação principal" onMouseLeave={() => setActivePanel(null)}>
    <Link className="brand premium-brand" href="/#inicio" onClick={goHome} aria-label="Insidely — início">inside<span>ly</span><i>.</i></Link>
    <nav className="premium-nav" aria-label="Seções do site">{(Object.keys(panels) as Exclude<PanelName, null>[]).map((key) => <button type="button" key={key} aria-expanded={activeName === key} onMouseEnter={() => setActivePanel({ name: key, path: pathname })} onFocus={() => setActivePanel({ name: key, path: pathname })} onClick={() => setActivePanel(activeName === key ? null : { name: key, path: pathname })}>{panels[key].label}<ChevronDown size={14}/></button>)}</nav>
    <div className="nav-actions premium-actions">{dashboardHref ? <Link className="button button-accent button-sm" href={dashboardHref}>Meu painel</Link> : <><Link className="button button-ghost button-sm" href="/entrar">Entrar</Link><Link className="button button-accent button-sm" href="/cadastro">Criar conta</Link></>}</div>
    <button className="mobile-menu" type="button" aria-label={mobileOpen ? "Fechar navegação" : "Abrir navegação"} onClick={() => setMobilePath(mobileOpen ? null : pathname)}>{mobileOpen ? <X size={22}/> : <Menu size={22}/>}</button>
    {activeName && <div className="mega-shell" role="region" aria-label={panels[activeName].label}><div className="mega-intro"><span className="eyebrow">{panels[activeName].eyebrow}</span><p>{panels[activeName].description}</p><Link href={panels[activeName].allHref}>{panels[activeName].allLabel}<ArrowUpRight size={15}/></Link></div><div className="mega-items">{panels[activeName].items.map(([href, label, detail]) => <Link key={href} href={href}><span>{label}</span><small>{detail}</small><ArrowUpRight size={17}/></Link>)}</div></div>}
  </header>{mobileOpen && <nav className="mobile-drawer" aria-label="Navegação móvel"><Link href="/buscar">Profissionais</Link><Link href="/empresas">Empresas</Link><Link href="/profissoes">Profissões</Link><Link href="/reality-check">Reality Check</Link><Link href="/sobre">Sobre</Link><Link href="/suporte">Suporte</Link>{dashboardHref ? <Link href={dashboardHref}>Meu painel</Link> : <><Link href="/entrar">Entrar</Link><Link href="/cadastro">Criar conta</Link></>}</nav>}</div>;
}
