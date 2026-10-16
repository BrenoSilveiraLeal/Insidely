"use client";

import { useRef, useState } from "react";

export function ConfirmAction({ action, label, title, description, confirmLabel, className }: {
  action: () => void | Promise<void>;
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
    {open && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title" aria-describedby="confirm-action-description" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <h2 id="confirm-action-title">{title}</h2><p id="confirm-action-description">{description}</p>
        <div className="confirm-dialog-actions"><button type="button" className="button button-ghost" onClick={() => setOpen(false)}>Cancelar</button><form action={action}><button ref={confirmRef} type="submit" className="button button-danger">{confirmLabel}</button></form></div>
      </section>
    </div>}
  </>;
}
