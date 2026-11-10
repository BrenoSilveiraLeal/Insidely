import Link from "next/link";
import { DashboardNavToggle } from "@/components/dashboard-nav-toggle";
import { getNavState } from "@/lib/nav-badges";
import { RememberDashboardMode, SidebarMemory } from "@/components/dashboard-mode";
import { NotificationPopover } from "@/components/notification-popover";
import { AdminNotifications } from "@/components/admin-notifications";
import { RefreshStalePage } from "@/components/refresh-stale-page";

const menus = {
  user: [["/dashboard", "Visão geral"], ["/dashboard/favoritos", "Favoritos"], ["/dashboard/mensagens", "Mensagens"], ["/dashboard/avaliacoes", "Avaliações"], ["/dashboard/configuracoes", "Configurações"]],
  consultant: [["/consultor", "Visão geral"], ["/consultor/agenda", "Horários"], ["/consultor/consultas", "Chats"], ["/consultor/ganhos", "Ganhos"], ["/consultor/privacidade", "Privacidade"], ["/consultor/perfil", "Editar perfil"], ["/dashboard/configuracoes?context=consultant", "Conta e segurança"]],
  admin: [["/admin", "Visão geral"], ["/admin/casos", "Casos"], ["/admin/verificacoes", "Verificações"], ["/admin/catalogo", "Empresas e áreas"], ["/admin/historias", "Histórias"], ["/admin/usuarios", "Usuários"], ["/admin/denuncias", "Denúncias"], ["/admin/suporte", "Chamados de suporte"], ["/admin/registro", "Registro de ações"], ["/admin/status", "Status do sistema"], ["/dashboard/configuracoes", "Conta e segurança"]],
  support: [["/admin/casos", "Casos"], ["/admin/sancoes", "Advertências e suspensões"],["/dashboard/configuracoes", "Conta e segurança"]],
} as const;

// The bell and the menu counts are read here, so every page of the panel shows the same ones.
// activeHref: the menu item to mark when the page lives outside it (a conversation under "Consultas e mensagens").
export async function DashboardShell({ mode, title, children, profileId, canClient = false, canConsultant = false, activeHref, skeleton = false }: { mode: keyof typeof menus; title: string; children: React.ReactNode; profileId?: string | null; canClient?: boolean; canConsultant?: boolean; activeHref?: string; skeleton?: boolean }) {
  // A loading screen (skeleton) skips the menu counts: it must show at once, and it remembers nothing.
  const nav = !skeleton && (mode === "user" || mode === "consultant") ? await getNavState(mode) : null;
  const item = (href: string, label: string) => { const count = nav?.badges[href.split("?")[0]] ?? 0; return <Link key={href} href={href}>{label}{count > 0 && <span className="nav-badge" aria-label={`${count} novidade${count === 1 ? "" : "s"}`}>{count > 99 ? "99+" : count}</span>}</Link>; };
  const profileHref = profileId ? `/profissional/${profileId}` : "/profissional/me";
  return <main className="dash">{!skeleton && <><RememberDashboardMode mode={mode} canConsultant={canConsultant}/><RefreshStalePage renderId={crypto.randomUUID()}/><SidebarMemory/></>}<div className="dash-shell"><aside className="sidebar"><Link className="brand" href="/">insidely<span className="brand-dot">.</span></Link><DashboardNavToggle activeHref={activeHref}><nav className={`side-nav side-nav-${mode}`}>
    {mode === "consultant" ? <>
      <div className="side-nav-section"><span className="side-nav-label">Trabalho</span>{menus.consultant.slice(0, 4).map(([href, label]) => item(href, label))}</div>
      <div className="side-nav-section side-nav-secondary"><span className="side-nav-label">Meu perfil</span><Link href="/consultor/perfil">Editar perfil</Link><Link href="/consultor/privacidade">Privacidade do perfil</Link><Link href={profileHref}>Ver meu perfil público</Link></div>
      <div className="side-nav-section side-nav-secondary"><span className="side-nav-label">Conta</span><Link href="/dashboard/configuracoes?context=consultant">Conta e segurança</Link><Link href="/dashboard/favoritos?context=consultant">Meus favoritos</Link><Link href="/dashboard/suporte">Suporte</Link></div>
      <div className="side-nav-footer"><Link href="/dashboard">Modo cliente</Link><Link href="/buscar">Ver plataforma</Link><form action="/auth/sair" method="post"><button className="side-nav-logout" type="submit">Sair</button></form></div>
    </> : <>
      {menus[mode].map(([href, label]) => item(href, label))}
      {canClient && <Link href="/dashboard">Modo cliente</Link>}{canConsultant && mode === "user" && <Link href="/consultor">Modo consultor</Link>}{!canConsultant && mode === "user" && <Link href="/dashboard/virar-consultor">Virar consultor</Link>}
      {mode !== "admin" && mode !== "support" && <Link href="/dashboard/suporte">Suporte</Link>}<Link href="/buscar">Ver plataforma</Link><form action="/auth/sair" method="post"><button className="side-nav-logout" type="submit">Sair</button></form>
    </>}
  </nav></DashboardNavToggle></aside><section className="dash-main"><div className="dash-top"><div><span className="eyebrow">Painel {mode === "user" ? "pessoal" : mode === "consultant" ? "do consultor" : mode === "support" ? "do suporte" : "administrativo"}</span><h1 className="dash-title">{title}</h1></div>{mode === "admin" || mode === "support" ? <AdminNotifications/> : <NotificationPopover notifications={nav?.notifications ?? []} />}</div>{children}</section></div></main>;
}
