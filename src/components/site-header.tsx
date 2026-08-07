import Link from "next/link";
import { Menu } from "lucide-react";
import { auth } from "@/auth";

export async function SiteHeader() {
  const session = await auth();
  return <div className="header-wrap"><header className="header" aria-label="Navegação principal">
    <Link className="brand" href="/">insidely<span className="brand-dot">.</span></Link>
    <nav className="nav">
      <Link href="/buscar">Profissionais</Link><Link href="/empresas">Empresas</Link><Link href="/profissoes">Profissões</Link><Link href="/reality-check">Reality Check</Link>
    </nav>
    <div className="nav-actions">
      {session?.user ? <Link className="button button-accent button-sm" href={session.user.role === "ADMIN" ? "/admin" : session.user.role === "CONSULTANT" ? "/consultor" : "/dashboard"}>Meu painel</Link> : <><Link className="button button-ghost button-sm" href="/entrar">Entrar</Link><Link className="button button-accent button-sm" href="/cadastro">Criar conta</Link></>}
    </div>
    <Link className="mobile-menu" href="/buscar" aria-label="Abrir navegação"><Menu size={22}/></Link>
  </header></div>;
}

