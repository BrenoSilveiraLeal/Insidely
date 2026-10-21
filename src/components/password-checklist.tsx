"use client";

import { useEffect, useRef, useState } from "react";

const rules = [
  { label: "8 caracteres ou mais", test: (value: string) => value.length >= 8 },
  { label: "Uma letra maiúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Um número", test: (value: string) => /\d/.test(value) },
];

/** Live password rules for the field named `name` in the same form, so nobody learns them only after submitting. */
export function PasswordChecklist({ name = "password", confirmName }: { name?: string; confirmName?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const [value, setValue] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    const form = ref.current?.closest("form");
    const input = form?.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    const confirm = confirmName ? form?.querySelector<HTMLInputElement>(`input[name="${confirmName}"]`) : null;
    if (!input) return;
    const update = () => { setValue(input.value); if (confirm) setConfirmation(confirm.value || null); };
    input.addEventListener("input", update);
    confirm?.addEventListener("input", update);
    return () => { input.removeEventListener("input", update); confirm?.removeEventListener("input", update); };
  }, [name, confirmName]);

  const items = [...rules.map((rule) => ({ label: rule.label, ok: rule.test(value) })), ...(confirmName && confirmation !== null ? [{ label: "As senhas coincidem", ok: confirmation === value }] : [])];
  return <ul ref={ref} className="password-checklist" aria-live="polite">
    {items.map((item) => <li key={item.label} data-ok={item.ok || undefined}><span aria-hidden="true">{item.ok ? "✓" : "•"}</span>{item.label}<span className="sr-only">{item.ok ? " — atendido" : " — pendente"}</span></li>)}
  </ul>;
}
