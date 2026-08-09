import Link from "next/link";

export function SiteFooter() {
  return <footer className="footer"><div className="container">
    <div className="footer-grid">
      <div><Link className="brand premium-brand" href="/#inicio">inside<span>ly</span><i>.</i></Link><p className="muted">A realidade antes da decisão.</p></div>
      <div><h4>Descobrir</h4><div className="footer-links"><Link href="/buscar">Profissionais</Link><Link href="/empresas">Empresas</Link><Link href="/profissoes">Profissões</Link></div></div>
      <div><h4>Participar</h4><div className="footer-links"><Link href="/cadastro">Criar conta</Link><Link href="/onboarding">Ser consultor</Link><Link href="/reality-check">Reality Check</Link></div></div>
      <div><h4>Confiança</h4><div className="footer-links"><span>Privacidade por padrão</span><span>Perfis verificados</span><span>Moderação humana</span></div></div>
    </div>
    <div className="footer-note">MVP acadêmico demonstrativo. Empresas citadas não patrocinam nem mantêm vínculo com a plataforma. © {new Date().getFullYear()} Insidely.</div>
  </div></footer>;
}
