"use client";
import { useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { createBookingAction } from "@/app/actions";

export function BookingRequestForm({ profileId, children }: { profileId: string; children: ReactNode }) {
  const [state, action, pending] = useActionState(createBookingAction.bind(null, profileId), undefined);
  const form = useRef<HTMLFormElement>(null);
  const savedValues = useRef<Map<string, string[]>>(new Map());
  function preserveValues(event: FormEvent<HTMLFormElement>) {
    const values = new Map<string, string[]>();
    for (const [key, value] of new FormData(event.currentTarget)) {
      const list = values.get(key) ?? [];
      list.push(String(value));
      values.set(key, list);
    }
    savedValues.current = values;
  }
  useEffect(() => {
    if (state?.status !== "error" || !form.current) return;
    for (const [name, values] of savedValues.current) {
      const controls = form.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${CSS.escape(name)}"]`);
      for (const control of controls) {
        if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) control.checked = values.includes(control.value);
        else if (control instanceof HTMLSelectElement && control.multiple) for (const option of control.options) option.selected = values.includes(option.value);
        else control.value = values[0] ?? "";
      }
    }
  }, [state]);
  return <form ref={form} action={action} onSubmit={preserveValues} className="panel form-stack">
    {children}
    {state?.status === "error" && <p className="form-alert" role="alert">{state.message}</p>}
    <button className="button button-dark" type="submit" disabled={pending}>{pending ? "Preparando checkout…" : "Continuar para o checkout"}</button>
  </form>;
}
