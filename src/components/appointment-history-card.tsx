"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { archiveCustomerBookingAction } from "@/app/actions";

const ArchiveBookingContext = createContext<{ archive: () => void; restore: () => void } | null>(null);

export function AppointmentHistoryCard({ children, status }: { children: ReactNode; status: string }) {
  const [hidden, setHidden] = useState(false);
  const [archiveFailed, setArchiveFailed] = useState(false);
  if (hidden) return null;

  return <ArchiveBookingContext.Provider value={{ archive: () => { setArchiveFailed(false); setHidden(true); }, restore: () => { setHidden(false); setArchiveFailed(true); } }}>
    <article className="panel appointment-card" data-booking-status={status}>{archiveFailed && <p className="form-error" role="alert">Não foi possível ocultar este histórico agora. Tente novamente.</p>}{children}</article>
  </ArchiveBookingContext.Provider>;
}

export function ArchiveAppointmentButton({ id }: { id: string }) {
  const context = useContext(ArchiveBookingContext);
  if (!context) throw new Error("ArchiveAppointmentButton deve estar dentro de AppointmentHistoryCard.");

  return <ConfirmAction
    action={archiveCustomerBookingAction.bind(null, id)}
    label="Ocultar do meu histórico"
    title="Ocultar este agendamento?"
    description="O registro continua guardado no sistema para segurança e suporte."
    confirmLabel="Ocultar histórico"
    className="button button-ghost button-sm"
    onOptimistic={context.archive}
    onError={context.restore}
  />;
}
