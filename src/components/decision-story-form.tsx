"use client";

import { useActionState } from "react";
import { saveDecisionStoryAction } from "@/app/actions";

export function DecisionStoryForm({ bookingId, defaultStory, defaultAllow }: { bookingId: string; defaultStory: string; defaultAllow: boolean }) {
  const [state, action, pending] = useActionState(saveDecisionStoryAction.bind(null, bookingId), undefined);
  return <form action={action} className="form-stack">
    <label className="field"><span>O que você decidiu depois da conversa?</span><textarea className="textarea" name="story" minLength={20} maxLength={600} required defaultValue={defaultStory} placeholder="Ex.: Aceitei a proposta e entrei no time. A conversa me mostrou como era a rotina e eu cheguei muito mais seguro."/></label>
    <label className="check-row"><input type="checkbox" name="allowPublish" defaultChecked={defaultAllow}/><span>Autorizo a Insidely a publicar este texto na página inicial, sem meu nome completo.</span></label>
    {state && <p className={state.status === "error" ? "form-error" : "form-feedback"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <button className="button button-accent" disabled={pending}>{pending ? "Enviando…" : "Enviar"}</button>
  </form>;
}
