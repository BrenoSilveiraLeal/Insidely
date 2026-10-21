"use client";

import { useActionState, useState } from "react";
import { requestEmailChangeAction } from "@/app/actions";

export function EmailChangeForm({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState(requestEmailChangeAction, undefined);
  const [open, setOpen] = useState(false);
  return <div className="field email-change">
    <label htmlFor="account-email">E-mail</label>
    <div className="email-change-current"><input id="account-email" className="input" value={email} readOnly /><button type="button" className="button button-ghost button-sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "Cancelar" : "Trocar e-mail"}</button></div>
    {open && <form action={action} className="form-stack email-change-form">
      <label>Novo e-mail<input className="input" name="newEmail" type="email" autoComplete="email" required /></label>
      {hasPassword && <label>Senha atual<input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></label>}
      {state && <p className={state.status === "success" ? "form-feedback" : "form-error"} role={state.status === "success" ? "status" : "alert"}>{state.message}</p>}
      <button type="submit" className="button button-dark" disabled={pending}>{pending ? "Enviando…" : "Enviar link de confirmação"}</button>
    </form>}
  </div>;
}
