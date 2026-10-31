"use client";
import { useActionState, useState } from "react";
import { requestRescheduleAction } from "@/app/actions";
import { money } from "@/lib/format";
import { rescheduleDifferenceCents } from "@/lib/booking-policy";

type Slot = { id: string; label: string; minutes: number };

// New slot and duration (never shorter than the current one), with the amount to pay shown live:
// the reschedule fee plus the price difference, if the new option costs more than what was paid.
export function RescheduleForm({ bookingId, slots, currentMinutes, price30Cents, price60Cents, paidSubtotalCents, feeCents }: { bookingId: string; slots: Slot[]; currentMinutes: number; price30Cents: number; price60Cents: number; paidSubtotalCents: number; feeCents: number }) {
  const [state, action, pending] = useActionState(requestRescheduleAction.bind(null, bookingId), undefined);
  const [slotId, setSlotId] = useState("");
  const [duration, setDuration] = useState(String(currentMinutes));
  const selected = slots.find((slot) => slot.id === slotId);
  const options = [30, 60].filter((minutes) => minutes >= currentMinutes && (!selected || selected.minutes >= minutes));
  const effective = options.includes(Number(duration)) ? Number(duration) : options[0];
  const difference = effective ? rescheduleDifferenceCents(effective === 60 ? price60Cents : price30Cents, paidSubtotalCents) : 0;
  return <form action={action} className="panel form-stack">
    <div className="field"><label htmlFor="slot">Novo horário</label><select className="select" id="slot" name="slot" required value={slotId} onChange={(event) => setSlotId(event.target.value)}><option value="">Selecione</option>{slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label} · {slot.minutes} min</option>)}</select></div>
    <div className="field"><label htmlFor="duration">Duração</label>
      {options.length ? <select className="select" id="duration" name="duration" value={effective} onChange={(event) => setDuration(event.target.value)}>{options.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos · {money(minutes === 60 ? price60Cents : price30Cents)}</option>)}</select>
        : <small className="form-error">Este horário é curto demais para a duração da sua conversa. Escolha outro.</small>}
      <small className="muted">A duração pode continuar igual ou aumentar; não é possível reduzir.</small>
    </div>
    <ul className="detail-list">
      <li><span>Taxa de reagendamento</span><strong>{money(feeCents)}</strong></li>
      <li><span>Diferença de valor</span><strong>{difference ? money(difference) : "Sem diferença"}</strong></li>
      <li className="reschedule-summary-total"><span>Total a pagar</span><strong>{money(feeCents + difference)}</strong></li>
    </ul>
    {state?.status === "error" && <p className="form-alert" role="alert">{state.message}</p>}
    <button className="button button-dark" type="submit" disabled={pending || !options.length}>{pending ? "Reservando o horário…" : "Reservar horário e pagar"}</button>
  </form>;
}
