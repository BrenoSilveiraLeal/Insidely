"use client";

import { useActionState } from "react";
import { updateAccountNameAction } from "@/app/actions";

export function AccountNameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateAccountNameAction, undefined);
  return <form action={action} className="form-stack">
    <div className="field"><label htmlFor="account-name">Nome de exibição</label><input className="input" id="account-name" name="name" defaultValue={name} minLength={2} maxLength={80} required/><small className="muted">Esse nome aparece no painel e nas conversas.</small></div>
    {state && <p className={state.status === "error" ? "form-error" : "form-feedback"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar nome"}</button>
  </form>;
}
