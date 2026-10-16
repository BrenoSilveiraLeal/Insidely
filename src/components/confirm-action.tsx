"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";

export function ConfirmAction({ action, label, title, description, confirmLabel, className, onOptimistic, onError }: {
  action: () => void | Promise<void>;
  label: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  className?: string;
  onOptimistic?: () => void;
  onError?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  return <>
    <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
    {open && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title" aria-describedby="confirm-action-description" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <h2 id="confirm-action-title">{title}</h2><p id="confirm-action-description">{description}</p>
        {error && <p className="form-error" role="alert">Não foi possível concluir agora. Tente novamente.</p>}
        <div className="confirm-dialog-actions"><button type="button" className="button button-ghost" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button ref={confirmRef} type="button" className="button button-danger" disabled={pending} onClick={async () => {
          setPending(true);
          setError(false);
          onOptimistic?.();
          if (onOptimistic) setOpen(false);
          try {
            await action();
            if (!onOptimistic) setOpen(false);
          } catch {
            onError?.();
            if (!onOptimistic) setError(true);
          } finally {
            if (!onOptimistic) setPending(false);
          }
        }}>{pending ? "Aguarde…" : confirmLabel}</button></div>
      </section>
    </div>}
  </>;
}
