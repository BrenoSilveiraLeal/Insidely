"use client";

import { ArrowLeft, RotateCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

// "Instabilidade temporária": shown when a page fails to render (app/error.tsx) or when even the
// root layout fails (app/global-error.tsx). Same visual family as the 404 page. The error digest
// is shown as a short code the person can quote to support; it carries no personal data.
export function ErrorScreen({ digest, retry }: { digest?: string; retry: () => void }) {
  const [offline, setOffline] = useState(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const tryAgain = () => { setRetrying(true); retry(); setTimeout(() => setRetrying(false), 2500); };
  const code = digest ? digest.slice(0, 10).toUpperCase() : null;
  return <main className="not-found-page error-page" id="conteudo-principal">
    <div className="container">
      <a className="error-brand" href="/">insidely<span className="brand-dot">.</span></a>
      <section className="not-found-panel" aria-labelledby="error-title">
        <div className="not-found-copy">
          <p className="not-found-label">{offline ? "Sem conexão" : "Instabilidade temporária"}</p>
          <h1 id="error-title">{offline ? "Parece que a internet caiu." : "Algo saiu do ar por um instante."}</h1>
          <p>{offline ? "Assim que a conexão voltar, toque em tentar de novo. Nada do que você fez foi perdido." : "Seus dados estão seguros. Tente de novo em alguns segundos: na maioria das vezes, isso resolve."}</p>
          <div className="not-found-actions">
            <button className="button button-accent" type="button" onClick={tryAgain} disabled={retrying}><RotateCw size={17} className={retrying ? "error-spin" : undefined}/>{retrying ? "Tentando…" : "Tentar de novo"}</button>
            <a className="button button-ghost" href="/"><ArrowLeft size={17}/>Voltar para o início</a>
          </div>
          <p className="error-support">Se continuar, <a href="/suporte">fale com o suporte</a>{code ? <> e informe o código <code>{code}</code></> : null}.</p>
        </div>
        <div className="not-found-art error-art" aria-hidden="true">
          {offline ? <WifiOff size={88} strokeWidth={1.6}/> : <span className="error-pulse"/>}
          <small>{offline ? "Esperando a conexão voltar" : "Já estamos de volta em instantes"}</small>
        </div>
      </section>
    </div>
  </main>;
}
