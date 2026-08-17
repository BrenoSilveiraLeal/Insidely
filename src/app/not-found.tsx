import Link from "next/link";

export default function NotFound() {
  return <main className="section"><div className="container"><section className="panel"><span className="eyebrow">Erro 404</span><h1>Página não encontrada.</h1><p className="muted">O endereço pode ter mudado ou não estar mais disponível.</p><Link className="button button-dark" href="/">Voltar para a página inicial</Link></section></div></main>;
}
