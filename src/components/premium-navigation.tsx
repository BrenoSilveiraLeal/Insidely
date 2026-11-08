"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PanelName = "profissionais" | "empresas" | "profissoes" | "reality" | null;
type ActivePanel = { name: Exclude<PanelName, null>; path: string } | null;

const panels = {
  profissionais: { label: "Profissionais", eyebrow: "Conversas com contexto", description: "Encontre pessoas verificadas por empresa, área e experiência para fazer perguntas que importam.", allHref: "/buscar", allLabel: "Explorar todos os profissionais", items: [["/buscar?mode=REMOTE", "Trabalho remoto", "Rotina, autonomia e comunicação"], ["/buscar?mode=HYBRID", "Trabalho híbrido", "Cultura, encontros e flexibilidade"], ["/buscar?mode=ONSITE", "Trabalho presencial", "Ambiente, liderança e operação"]] },
  empresas: { label: "Empresas", eyebrow: "Ambientes de trabalho", description: "Veja a mesma empresa por diferentes áreas, níveis e momentos de carreira.", allHref: "/empresas", allLabel: "Explorar todas as empresas", items: [["/empresa/amazon", "Amazon", "Tecnologia e varejo"], ["/empresa/nubank", "Nubank", "Serviços financeiros"], ["/empresa/mercado-livre", "Mercado Livre", "Tecnologia e comércio"]] },
  profissoes: { label: "Profissões", eyebrow: "Rotinas por área", description: "Compare a ideia que você tem da profissão com a prática de quem já está nela.", allHref: "/profissoes", allLabel: "Explorar todas as profissões", items: [["/profissao/desenvolvimento-de-software", "Software", "Produto, código e carreira"], ["/profissao/dados", "Dados", "Análise, ciência e decisões"], ["/profissao/ux-ui", "UX/UI", "Pesquisa, interface e produto"]] },
  reality: { label: "Reality Check", eyebrow: "Expectativa à realidade", description: "Um ponto de partida para investigar o que não aparece na descrição da vaga.", allHref: "/reality-check", allLabel: "Ver todos os Reality Checks", items: [["/reality-check/desenvolvimento-de-software", "Software", "O trabalho além do código"], ["/reality-check/enfermagem", "Enfermagem", "Cuidado, plantão e rotina"], ["/reality-check/vendas", "Vendas", "Meta, relacionamento e pressão"]] },
} as const;

function jumpToTop() { const root = document.documentElement; const previousBehavior = root.style.scrollBehavior; root.style.scrollBehavior = "auto"; window.scrollTo({ top: 0, left: 0 }); window.requestAnimationFrame(() => { root.style.scrollBehavior = previousBehavior; }); }

// Reads the session from the auth cookie in the browser, so public pages stay static (and instantly
// prefetchable) instead of being rendered per visitor just to pick the header buttons.
// "incomplete" is a signed-in account that never finished the sign-up (no client or consultant
// role chosen yet): the header then shows Entrar / Criar conta as for a visitor.
type AuthState = "out" | "incomplete" | "in" | null;
function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(null);
  useEffect(() => {
    let active = true;
    const client = createSupabaseBrowserClient();
    const resolve = async (userId: string | undefined) => {
      if (!userId) { if (active) setState("out"); return; }
      const key = `insidely-onboarded:${userId}`;
      try { if (sessionStorage.getItem(key) === "1") { if (active) setState("in"); return; } } catch { /* storage unavailable */ }
      const { data } = await client.from("User").select("onboardingCompleted").eq("auth_user_id", userId).maybeSingle();
      // Unknown (no row visible) counts as complete, so the header never hides a real dashboard.
      const done = data ? Boolean((data as { onboardingCompleted: boolean }).onboardingCompleted) : true;
      if (done) { try { sessionStorage.setItem(key, "1"); } catch { /* not remembered */ } }
      if (active) setState(done ? "in" : "incomplete");
    };
    void client.auth.getSession().then(({ data }) => resolve(data.session?.user.id)).catch(() => { if (active) setState("out"); });
    const { data } = client.auth.onAuthStateChange((_event, session) => { void resolve(session?.user.id); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return state;
}

export function PremiumNavigation() {
  const auth = useAuthState();
  // /continuar sends each role to its own dashboard (and through 2FA when needed).
  const dashboardHref = auth === "in" ? "/continuar" : null;
  // An unfinished sign-up continues where it stopped.
  const signupHref = auth === "incomplete" ? "/onboarding" : "/cadastro";
  const pathname = usePathname(); const router = useRouter(); const [activePanel, setActivePanel] = useState<ActivePanel>(null); const [panelOpen, setPanelOpen] = useState(false); const closePanelTimer = useRef<number | null>(null); const [mobilePath, setMobilePath] = useState<string | null>(null);
  const activeName = activePanel?.path === pathname ? activePanel.name : null; const mobileOpen = mobilePath === pathname; const showPanel = (name: Exclude<PanelName, null>) => { if (closePanelTimer.current) window.clearTimeout(closePanelTimer.current); setActivePanel({ name, path: pathname }); setPanelOpen(true); }; const hidePanel = () => { setPanelOpen(false); if (closePanelTimer.current) window.clearTimeout(closePanelTimer.current); closePanelTimer.current = window.setTimeout(() => setActivePanel(null), 280); };
  useEffect(() => { jumpToTop(); if (closePanelTimer.current) window.clearTimeout(closePanelTimer.current); const timeout = window.setTimeout(() => { setActivePanel(null); setMobilePath(null); }, 0); return () => window.clearTimeout(timeout); }, [pathname]); useEffect(() => () => { if (closePanelTimer.current) window.clearTimeout(closePanelTimer.current); }, []);
  useEffect(() => {
    // Depois da primeira pintura, deixa as rotas mais usadas prontas no cache
    // do roteador. Assim o clique não começa uma navegação do zero.
    const timeout = window.setTimeout(() => {
      ["/buscar", "/empresas", "/profissoes", "/reality-check"].forEach((href) => router.prefetch(href));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [router]);
  const goHome = (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); setActivePanel(null); setMobilePath(null); if (pathname === "/") { window.history.replaceState(null, "", "/#inicio"); jumpToTop(); return; } router.push("/#inicio"); };
  const panel = activeName ? panels[activeName] : null;
  return <div className="header-wrap"><header className="header premium-header" aria-label="Navegação principal" onMouseLeave={hidePanel}>
    <Link className="brand premium-brand" href="/#inicio" onClick={goHome} aria-label="Insidely - início">inside<span>ly</span><i>.</i></Link>
    <nav className="premium-nav" aria-label="Seções do site">{(Object.keys(panels) as Exclude<PanelName, null>[]).map((key) => <button type="button" key={key} aria-expanded={panelOpen && activeName === key} onMouseEnter={() => showPanel(key)} onFocus={() => showPanel(key)} onClick={() => showPanel(key)}>{panels[key].label}<ChevronDown size={14}/></button>)}</nav>
    <div className="nav-actions premium-actions" data-auth-pending={auth === null || undefined}>{dashboardHref ? <Link className="button button-accent button-sm" href={dashboardHref}>Meu painel</Link> : <><Link className="button button-ghost button-sm" href="/entrar">Entrar</Link><Link className="button button-accent button-sm" href={signupHref}>Criar conta</Link></>}</div>
    <button className="mobile-menu" type="button" aria-label={mobileOpen ? "Fechar navegação" : "Abrir navegação"} onClick={() => setMobilePath(mobileOpen ? null : pathname)}>{mobileOpen ? <X size={22}/> : <Menu size={22}/>}</button>
    <div className="mega-shell" data-open={panelOpen && Boolean(panel)} aria-hidden={!panelOpen || !panel} inert={!panelOpen || !panel} role="region" aria-label={panel?.label ?? "Navegação"}>
      {panel && <>
        <div className="mega-intro"><span className="eyebrow">{panel.eyebrow}</span><p>{panel.description}</p><Link href={panel.allHref}>{panel.allLabel}<ArrowUpRight size={15}/></Link></div>
        <div className="mega-items">{panel.items.map(([href, label, detail]) => <Link key={href} href={href}><span>{label}</span><small>{detail}</small><ArrowUpRight size={17}/></Link>)}</div>
      </>}
    </div>
  </header><nav className="mobile-drawer" data-open={mobileOpen} aria-hidden={!mobileOpen} inert={!mobileOpen} aria-label="Navegação móvel"><Link href="/buscar">Profissionais</Link><Link href="/empresas">Empresas</Link><Link href="/profissoes">Profissões</Link><Link href="/reality-check">Reality Check</Link><Link href="/sobre">Sobre</Link><Link href="/suporte">Suporte</Link>{dashboardHref ? <Link href={dashboardHref}>Meu painel</Link> : <><Link href="/entrar">Entrar</Link><Link href={signupHref}>Criar conta</Link></>}</nav></div>;
}
