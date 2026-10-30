"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const KEY = "insidely-cookie-consent";
type Choice = "accepted" | "refused";

// Usage statistics (Vercel Analytics and Speed Insights) only load after the visitor accepts.
// Everything the site needs to work (sign-in session, security) does not depend on this choice.
export function CookieConsent() {
  const [choice, setChoice] = useState<Choice | null | undefined>(undefined);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage blocked: ask again */ }
    // Reading the stored choice after mount keeps server and client markup identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(saved === "accepted" || saved === "refused" ? saved : null);
  }, []);
  const decide = (value: Choice) => { try { localStorage.setItem(KEY, value); } catch { /* remembered for this visit only */ } setChoice(value); };
  if (choice === "accepted") return <><Analytics/><SpeedInsights/></>;
  if (choice !== null) return null;
  return <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Aviso de cookies">
    <p>Usamos cookies essenciais para manter você conectado e seguro. Com a sua permissão, também coletamos estatísticas anônimas de uso para melhorar o site. <Link className="text-link" href="/privacidade">Saiba mais</Link></p>
    <div className="cookie-banner-actions"><button className="button button-ghost button-sm" type="button" onClick={() => decide("refused")}>Só os essenciais</button><button className="button button-accent button-sm" type="button" onClick={() => decide("accepted")}>Aceitar estatísticas</button></div>
  </div>;
}
