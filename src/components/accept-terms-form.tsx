"use client";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { acceptTermsAction } from "@/app/actions";

// After the acceptance is saved, a full page load (not a client navigation) opens the next page, so
// nothing rendered before the acceptance can bring the person back to the terms screen.
// The checkbox is controlled: React resets uncontrolled fields when the action finishes, which
// unticked it while the next page was still loading.
export function AcceptTermsForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState(acceptTermsAction, undefined);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => { if (state?.next) window.location.replace(state.next); }, [state]);
  return <form action={action} className="auth-form form-stack">
    {children}
    <label className="check-row"><input type="checkbox" name="accept" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>Li e aceito a nova versão dos Termos de Uso e da Política de Privacidade.</span></label>
    {state?.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="button button-accent" type="submit" disabled={pending || Boolean(state?.next)}>{pending || state?.next ? "Abrindo…" : "Aceitar e continuar"}</button>
  </form>;
}
