"use client";

import { CalendarPlus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createAvailabilityAction, removeAvailabilityAction } from "@/app/actions";

type Slot = { id: string; startsAt: string; endsAt: string; isBooked: boolean; label: string };

export function AvailabilityManager({ slots }: { slots: Slot[] }) {
  const [state, action, pending] = useActionState(createAvailabilityAction, undefined);
  const localDateInput = useRef<HTMLInputElement>(null);
  const utcDateInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { if (state?.status === "success") router.refresh(); }, [router, state]);

  return <div className="agenda-grid">
    <section className="panel">
      <span className="eyebrow">Novo horário</span>
      <h2>Abra sua agenda.</h2>
      <p className="muted">Adicione uma data e hora para que seu perfil apareça com opções reais de conversa.</p>
      <form className="form-stack" action={action} onSubmit={() => {
        const localValue = localDateInput.current?.value;
        if (localValue && utcDateInput.current) utcDateInput.current.value = new Date(localValue).toISOString();
      }}>
        <input ref={utcDateInput} type="hidden" name="startsAt" />
        <div className="field">
          <label htmlFor="availability-start">Data e hora</label>
          <input ref={localDateInput} className="input" id="availability-start" type="datetime-local" required />
          <small className="muted">Informe no seu fuso horário; o perfil exibe os horários de Brasília.</small>
        </div>
        <div className="field">
          <label htmlFor="availability-duration">Duração</label>
          <select className="select" id="availability-duration" name="duration" defaultValue="30">
            <option value="30">30 minutos</option>
            <option value="60">1 hora</option>
          </select>
        </div>
        {state && <p className={state.status === "error" ? "form-error" : "form-feedback"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
        <button className="button button-accent" disabled={pending}><CalendarPlus size={16}/>{pending ? "Adicionando..." : "Adicionar horário"}</button>
      </form>
    </section>

    <section className="panel">
      <span className="eyebrow">Seus próximos horários</span>
      <h2>Disponibilidade</h2>
      <div className="list agenda-list">
        {slots.length ? slots.map((slot) => <div className="list-row" key={slot.id}>
          <div><strong>{slot.label}</strong><p className="muted">até {slot.endsAt} · Brasília</p></div>
          {slot.isBooked ? <span className="status">Reservado</span> : <form action={removeAvailabilityAction.bind(null, slot.id)}><button className="button button-ghost button-sm" aria-label={`Remover horário ${slot.label}`}><Trash2 size={15}/> Remover</button></form>}
        </div>) : <p className="muted">Você ainda não tem horários futuros. Adicione um para que as pessoas possam escolher uma conversa.</p>}
      </div>
    </section>
  </div>;
}
