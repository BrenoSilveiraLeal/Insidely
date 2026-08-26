"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

export function ProfileShareButton({ profileId }: { profileId: string }) {
  const [shared, setShared] = useState(false);

  async function shareProfile() {
    const url = `${window.location.origin}/profissional/${profileId}`;
    try {
      if (navigator.share) await navigator.share({ title: "Perfil profissional", url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 2200);
    } catch {
      // Fechar o menu nativo de compartilhamento não é um erro.
    }
  }

  return <button className="button button-ghost button-sm" type="button" onClick={shareProfile}>
    {shared ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
    {shared ? "Link copiado" : "Compartilhar perfil"}
  </button>;
}
