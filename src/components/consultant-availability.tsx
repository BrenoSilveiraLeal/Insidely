"use client";

import { CalendarPlus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAvailabilityAction, createInstantAvailabilityAction, removeAvailabilityAction } from "@/app/actions";

// Start times every 30 minutes, 06:00 to 23:30.
const TIMES = Array.from({ length: 36 }, (_, index) => { const minutes = 360 + index * 30; return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 ? "30" : "00"}`; });

type Slot = { id: string; startsAt: string; endsAt: string; isBooked: boolean; label: string };

export function AvailabilityManager({ slots }: { slots: Slot[] }) {
  const [state, action, pending] = useActionState(createAvailabilityAction, undefined);
  const [instantState, instantAction, instantPending] = useActionState(createInstantAvailabilityAction, undefined);
  const dateInput = useRef<HTMLInputElement>(null);
  const timeInput = useRef<HTMLSelectElement>(null);
  const utcDateInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  // Removed slots disappear at once; the server confirms in the background.
  const [removed, setRemoved] = useState<string[]>([]);
  const [, startRemoving] = useTransition();
  const remove = (id: string) => { setRemoved((list) => [...list, id]); startRemoving(async () => { await removeAvailabilityAction(id); router.refresh(); }); };
  const visible = slots.filter((slot) => !removed.includes(slot.id));

  useEffect(() => { if (state?.status === "success" || instantState?.status === "success") router.refresh(); }, [router, state, instantState]);

  return <div className="agenda-grid">
    <section className="panel">
      <span className="eyebrow">Novo horário</span>
      <h2>Abra sua agenda.</h2>
      <p className="muted">Adicione uma data e hora para que seu perfil apareça com opções reais de conversa.</p>
      <form action={instantAction} className="form-stack" style={{ marginBottom: 18 }}>
        {instantState && <p className={instantState.status === "error" ? "form-error" : "form-feedback"} role={instantState.status === "error" ? "alert" : "status"}>{instantState.message}</p>}
        <button className="button button-dark" disabled={instantPending}>{instantPending ? "Abrindo disponibilidade..." : "Estou disponível agora (30 min)"}</button>
      </form>
      <form className="form-stack" action={action} onSubmit={(event) => {
        // Day and time are picked separately (no half-typed date); they become one instant here.
        const day = dateInput.current?.value, time = timeInput.current?.value;
        if (!day || !time) { event.preventDefault(); return; }
        if (utcDateInput.current) utcDateInput.current.value = new Date(`${day}T${time}`).toISOString();
      }}>
        <input ref={utcDateInput} type="hidden" name="startsAt" />
        <div className="availability-when">
          <div className="field">
            <label htmlFor="availability-day">Dia</label>
            <input ref={dateInput} className="input" id="availability-day" type="date" required
              onInvalid={(event) => event.currentTarget.setCustomValidity(event.currentTarget.validity.valueMissing ? "Escolha o dia no calendário." : "Complete o dia, o mês e o ano.")}
              onInput={(event) => event.currentTarget.setCustomValidity("")}/>
          </div>
          <div className="field">
            <label htmlFor="availability-time">Horário</label>
            <select ref={timeInput} className="select" id="availability-time" required defaultValue=""
              onInvalid={(event) => event.currentTarget.setCustomValidity("Escolha o horário.")}
              onChange={(event) => event.currentTarget.setCustomValidity("")}>
              <option value="" disabled>Escolha</option>
              {TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </div>
        </div>
        <small className="muted">No seu fuso horário; o perfil exibe os horários de Brasília.</small>
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
        {visible.length ? visible.map((slot) => <div className="list-row" key={slot.id}>
          <div><strong>{slot.label}</strong><p className="muted">até {slot.endsAt} · Brasília</p></div>
          {slot.isBooked ? <span className="status">Reservado</span> : <form action={() => remove(slot.id)}><button className="button button-ghost button-sm" aria-label={`Remover horário ${slot.label}`}><Trash2 size={15}/> Remover</button></form>}
        </div>) : <p className="muted">Você ainda não tem horários futuros. Adicione um para que as pessoas possam escolher uma conversa.</p>}
      </div>
    </section>
  </div>;
}
