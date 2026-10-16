import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { PublicShell } from "@/components/public-shell";

export const metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return <PublicShell><section className="not-found-page"><div className="container"><section className="not-found-panel" aria-labelledby="not-found-title"><div className="not-found-copy"><p className="not-found-label">Erro 404 · fora do caminho</p><h1 id="not-found-title">Essa página não existe por aqui.</h1><p>O endereço pode estar incompleto ou a página pode ter mudado. Volte para o início ou encontre uma experiência na Insidely.</p><div className="not-found-actions"><Link className="button button-accent" href="/"><ArrowLeft size={17}/>Voltar para o início</Link><Link className="button button-ghost" href="/buscar"><Search size={17}/>Encontrar profissionais</Link></div><Link className="not-found-support" href="/suporte">Precisa de ajuda? Fale com o suporte.</Link></div><div className="not-found-art" aria-hidden="true"><span>404</span><small>A rota não está no mapa.</small></div></section></div></section></PublicShell>;
}
