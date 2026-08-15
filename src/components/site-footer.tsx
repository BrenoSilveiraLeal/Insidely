import Link from "next/link";

export function SiteFooter() {
  return <footer className="footer"><div className="container">
    <div className="footer-grid">
      <div><Link className="brand premium-brand" href="/#inicio">inside<span>ly</span><i>.</i></Link><p className="muted">A realidade antes da decisão.</p></div>
      <div><h4>Descobrir</h4><div className="footer-links"><Link href="/buscar">Profissionais</Link><Link href="/empresas">Empresas</Link><Link href="/profissoes">Profissões</Link></div></div>
      <div><h4>Participar</h4><div className="footer-links"><Link href="/cadastro">Criar conta</Link><Link href="/onboarding">Ser consultor</Link><Link href="/reality-check">Reality Check</Link></div></div>
      <div><h4>Insidely</h4><div className="footer-links"><Link href="/sobre">Sobre a ideia</Link><Link href="/suporte">Falar com o suporte</Link><Link href="/termos">Termos de Uso</Link><Link href="/privacidade">Política de Privacidade</Link></div></div>
    </div>
    <div className="footer-note">© {new Date().getFullYear()} Insidely. A realidade antes da decisão.</div>
  </div></footer>;
}
