"use client";

import { useEffect, useState } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/app/actions";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function base64ToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

// Turns phone/computer notifications on or off for this device.
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Browser capabilities and permission only exist on the client, after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !publicKey) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    void navigator.serviceWorker.register("/sw.js").then((registration) => registration.pushManager.getSubscription()).then((subscription) => setState(subscription ? "on" : "off")).catch(() => setState("unsupported"));
  }, [publicKey]);
  const enable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
      await savePushSubscriptionAction(JSON.parse(JSON.stringify(subscription)));
      setState("on");
    } catch {
      setState(Notification.permission === "denied" ? "denied" : "off");
    } finally { setBusy(false); }
  };
  const disable = async () => {
    setBusy(true);
    try {
      const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (subscription) { await removePushSubscriptionAction(subscription.endpoint); await subscription.unsubscribe(); }
      setState("off");
    } finally { setBusy(false); }
  };
  if (state === "loading") return null;
  return <section className="panel form-stack">
    <span className="eyebrow">Notificações no celular e no computador</span>
    {state === "unsupported" && <p className="muted">Este navegador não aceita notificações. No iPhone, primeiro adicione a Insidely à tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá.</p>}
    {state === "denied" && <p className="muted">As notificações estão bloqueadas neste navegador. Libere nas configurações do site (cadeado ao lado do endereço) e recarregue a página.</p>}
    {state === "off" && <><p className="muted">Receba neste aparelho os avisos de novas mensagens, conversas confirmadas e lembretes, mesmo com o site fechado.</p><button className="button button-dark button-sm" type="button" disabled={busy} onClick={enable}>{busy ? "Ativando…" : "Ativar notificações neste aparelho"}</button></>}
    {state === "on" && <><p className="muted">Notificações ativadas neste aparelho.</p><button className="button button-ghost button-sm" type="button" disabled={busy} onClick={disable}>Desativar neste aparelho</button></>}
  </section>;
}
