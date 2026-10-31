"use client";
import { useActionState, useEffect, type ReactNode } from "react";
import { acceptTermsAction } from "@/app/actions";
import { KeepValuesForm } from "@/components/keep-values-form";

// After the acceptance is saved, a full page load (not a client navigation) opens the next page, so
// nothing rendered before the acceptance can bring the person back to the terms screen.
// KeepValuesForm keeps the checkbox ticked while that page loads.
export function AcceptTermsForm({ children }: { children: ReactNode }) {
  const [state, action, pending] = useActionState(acceptTermsAction, undefined);
  useEffect(() => { if (state?.next) window.location.replace(state.next); }, [state]);
  return <KeepValuesForm action={action} className="auth-form form-stack">
    {children}
    {state?.error && <p className="form-error" role="alert">{state.error}</p>}
    <button className="button button-accent" type="submit" disabled={pending || Boolean(state?.next)}>{pending || state?.next ? "Abrindo…" : "Aceitar e continuar"}</button>
  </KeepValuesForm>;
}
