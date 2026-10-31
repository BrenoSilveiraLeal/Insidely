"use client";
import { useTransition } from "react";

// The chat box: the text is taken and the field cleared as soon as it is sent, and the button stays
// disabled until the server answers, so pressing Enter or "Enviar" again cannot resend the message.
export function ChatMessageForm({ action, returnTo, label }: { action: (formData: FormData) => Promise<void>; returnTo: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return <form className="message-form" onSubmit={(event) => {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (!String(formData.get("body") || "").trim()) return;
    form.reset();
    startTransition(() => action(formData));
  }}>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <input className="input" name="body" aria-label={label} placeholder="Escreva uma mensagem" maxLength={2000} autoComplete="off" required/>
    <button className="button button-dark" disabled={pending}>{pending ? "Enviando…" : "Enviar"}</button>
  </form>;
}
