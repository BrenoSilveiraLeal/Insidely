import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { DashboardNavToggle } from "@/components/dashboard-nav-toggle";
import { RememberDashboardMode } from "@/components/dashboard-mode";
import { AutoDismissNotices } from "@/components/auto-dismiss-notices";
import { Suspense } from "react";
import { NotificationPopover } from "@/components/notification-popover";
import { AdminNotifications } from "@/components/admin-notifications";

const menus = {
  user: [["/dashboard", "Visão geral"], ["/dashboard/agendamentos", "Agendamentos"], ["/dashboard/favoritos", "Favoritos"], ["/dashboard/mensagens", "Mensagens"], ["/dashboard/avaliacoes", "Avaliações"], ["/dashboard/configuracoes", "Configurações"]],
  consultant: [["/consultor", "Visão geral"], ["/consultor/agenda", "Agenda"], ["/consultor/consultas", "Consultas e mensagens"], ["/consultor/ganhos", "Ganhos"], ["/consultor/privacidade", "Privacidade"], ["/consultor/perfil", "Perfil e verificação"], ["/dashboard/configuracoes?context=consultant", "Conta e segurança"]],
  admin: [["/admin", "Visão geral"], ["/admin/casos", "Casos"], ["/admin/verificacoes", "Verificações"], ["/admin/catalogo", "Empresas e áreas"], ["/admin/historias", "Histórias"], ["/admin/usuarios", "Usuários"], ["/admin/denuncias", "Denúncias"], ["/admin/suporte", "Chamados de suporte"], ["/admin/registro", "Registro de ações"], ["/admin/status", "Status do sistema"], ["/dashboard/configuracoes", "Conta e segurança"]],
} as const;

type Notification = { id: string; title: string; body: string; href: string | null; readAt: string | null };

export function DashboardShell({ mode, title, children, profileId, notifications = [], canClient = false, canConsultant = false }: { mode: keyof typeof menus; title: string; children: React.ReactNode; profileId?: string | null; notifications?: Notification[]; canClient?: boolean; canConsultant?: boolean }) {
  const profileHref = profileId ? `/profissional/${profileId}` : "/profissional/me";
  return <main className="dash"><RememberDashboardMode mode={mode}/><Suspense fallback={null}><AutoDismissNotices/></Suspense><div className="dash-shell"><aside className="sidebar"><Link className="brand" href="/">insidely<span className="brand-dot">.</span></Link><DashboardNavToggle><nav className={`side-nav side-nav-${mode}`}>
    {mode === "consultant" ? <>
      <div className="side-nav-section"><span className="side-nav-label">Trabalho</span>{menus.consultant.slice(0, 4).map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</div>
      <div className="side-nav-section side-nav-secondary"><span className="side-nav-label">Conta</span>{menus.consultant.slice(4).map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</div>
      <div className="side-nav-footer"><Link className="side-nav-profile" href={profileHref}>Visualizar seu perfil</Link><Link href="/dashboard/favoritos?context=consultant">Meus favoritos</Link><Link href="/dashboard">Modo cliente</Link><Link href="/dashboard/suporte">Suporte</Link><Link href="/buscar">Ver plataforma</Link><form action={logoutAction}><button className="side-nav-logout" type="submit">Sair</button></form></div>
    </> : <>
      {menus[mode].map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      {canClient && <Link href="/dashboard">Modo cliente</Link>}{canConsultant && mode === "user" && <Link href="/consultor">Modo consultor</Link>}{!canConsultant && mode === "user" && <Link href="/dashboard/virar-consultor">Virar consultor</Link>}
      {mode !== "admin" && <Link href="/dashboard/suporte">Suporte</Link>}<Link href="/buscar">Ver plataforma</Link><form action={logoutAction}><button className="side-nav-logout" type="submit">Sair</button></form>
    </>}
  </nav></DashboardNavToggle></aside><section className="dash-main"><div className="dash-top"><div><span className="eyebrow">Painel {mode === "user" ? "pessoal" : mode === "consultant" ? "do consultor" : "administrativo"}</span><h1 className="dash-title">{title}</h1></div>{mode === "admin" ? <AdminNotifications/> : <NotificationPopover notifications={notifications} />}</div>{children}</section></div></main>;
}
