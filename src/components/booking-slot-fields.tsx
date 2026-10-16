"use client";
import { useState } from "react";

type Slot = { id: string; label: string; minutes: number };

export function BookingSlotFields({ slots, defaultSlot, price30, price60 }: { slots: Slot[]; defaultSlot?: string; price30: string; price60: string }) {
  const [slotId, setSlotId] = useState(slots.some(slot => slot.id === defaultSlot) ? defaultSlot! : "");
  const [duration, setDuration] = useState("30");
  const selected = slots.find(slot => slot.id === slotId);
  const allowsSixty = selected ? selected.minutes >= 60 : slots.some(slot => slot.minutes >= 60);
  const effectiveDuration = allowsSixty ? duration : "30";
  return <>
    <div className="field"><label htmlFor="slot">Horário</label><select className="select" id="slot" name="slot" required value={slotId} onChange={event => setSlotId(event.target.value)}><option value="">Selecione</option>{slots.map(slot => <option key={slot.id} value={slot.id}>{slot.label} · {slot.minutes} min</option>)}</select></div>
    <div className="field"><label htmlFor="duration">Duração</label><select className="select" id="duration" name="duration" value={effectiveDuration} onChange={event => setDuration(event.target.value)}><option value="30">30 minutos · {price30}</option>{allowsSixty && <option value="60">60 minutos · {price60}</option>}</select>{!allowsSixty && <small className="muted">{selected ? "Este horário comporta apenas 30 minutos." : "Este perfil tem apenas horários de 30 minutos disponíveis."}</small>}</div>
  </>;
}
