import Link from "next/link";
import { Bell } from "lucide-react";
import { logoutAction } from "@/app/actions";

const menus = {
  user: [["/dashboard", "Visão geral"], ["/dashboard/agendamentos", "Agendamentos"], ["/dashboard/favoritos", "Favoritos"], ["/dashboard/mensagens", "Mensagens"], ["/dashboard/avaliacoes", "Avaliações"], ["/dashboard/configuracoes", "Configurações"]],
  consultant: [["/consultor", "Visão geral"], ["/consultor/agenda", "Agenda"], ["/consultor/consultas", "Consultas e mensagens"], ["/consultor/ganhos", "Ganhos"], ["/consultor/privacidade", "Privacidade"], ["/consultor/perfil", "Perfil e verificação"]],
  admin: [["/admin", "Visão geral"], ["/admin/verificacoes", "Verificações"], ["/admin/usuarios", "Usuários"], ["/admin/denuncias", "Denúncias"], ["/admin/suporte", "Suporte"]],
} as const;

export function DashboardShell({ mode, title, children, profileId, notificationCount = 0, canClient = false, canConsultant = false }: { mode: keyof typeof menus; title: string; children: React.ReactNode; profileId?: string | null; notificationCount?: number; canClient?: boolean; canConsultant?: boolean }) {
  const notificationHref = mode === "consultant" ? "/consultor#notificacoes" : "/dashboard";
  const profileHref = profileId ? `/profissional/${profileId}` : "/profissional/me";
  return <main className="dash"><div className="dash-shell"><aside className="sidebar"><Link className="brand" href="/">insidely<span className="brand-dot">.</span></Link><nav className={`side-nav side-nav-${mode}`}>
    {mode === "consultant" ? <>
      <div className="side-nav-section">
        <span className="side-nav-label">Trabalho</span>
        {menus.consultant.slice(0, 4).map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </div>
      <div className="side-nav-section side-nav-secondary">
        <span className="side-nav-label">Conta</span>
        {menus.consultant.slice(4).map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </div>
      <div className="side-nav-footer">
        <Link className="side-nav-profile" href={profileHref}>Visualizar seu perfil</Link>
        <Link href="/dashboard">Modo cliente</Link>
        <Link href="/suporte">Suporte</Link>
        <Link href="/buscar">Ver plataforma</Link>
        <form action={logoutAction}><button className="button button-ghost button-sm" type="submit">Sair</button></form>
      </div>
    </> : <>
      {menus[mode].map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      {canClient && <Link href="/dashboard">Modo cliente</Link>}
      {canConsultant && mode === "user" && <Link href="/consultor">Modo consultor</Link>}
      <Link href="/suporte">Suporte</Link><Link href="/buscar">Ver plataforma</Link>
      <form action={logoutAction}><button className="button button-ghost button-sm" type="submit">Sair</button></form>
    </>}
  </nav></aside><section className="dash-main"><div className="dash-top"><div><span className="eyebrow">Painel {mode === "user" ? "pessoal" : mode === "consultant" ? "do consultor" : "administrativo"}</span><h1 className="dash-title">{title}</h1></div>{mode === "consultant" && <Link className={`notification-bell ${notificationCount ? "notification-bell-active" : ""}`} href={notificationHref} aria-label={notificationCount ? `${notificationCount} nova${notificationCount === 1 ? "" : "s"} solicitação${notificationCount === 1 ? "" : "ões"}` : "Notificações"}><Bell size={19} aria-hidden="true" />{notificationCount > 0 && <span>{notificationCount > 99 ? "99+" : notificationCount}</span>}</Link>}</div>{children}</section></div></main>;
}
