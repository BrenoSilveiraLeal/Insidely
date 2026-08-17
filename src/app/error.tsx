"use client";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="section"><div className="container"><section className="panel"><span className="eyebrow">Instabilidade temporária</span><h1>Esta página não pôde carregar.</h1><p className="muted">Tente novamente. Se o problema continuar, nossa equipe poderá analisar o ocorrido sem expor seus dados.</p><button className="button button-dark" onClick={() => retry()}>Tentar novamente</button></section></div></main>;
}
