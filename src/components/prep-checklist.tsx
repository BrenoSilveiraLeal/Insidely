"use client";

import { useEffect, useState } from "react";

const ITEMS = [
  "Testei câmera e microfone (meet.google.com/new → \"Verificar áudio e vídeo\")",
  "Estou num lugar silencioso e com boa internet",
  "Reli o que foi combinado e anotei minhas perguntas",
  "Sei que a sala abre exatamente no horário marcado",
];

// A short guide shown in the hours before a conversation. Ticks are remembered in this browser only.
export function PrepChecklist({ bookingId }: { bookingId: string }) {
  const key = `insidely-prep-${bookingId}`;
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
      // Restoring the ticks saved in this browser after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setDone(saved.filter((item) => typeof item === "number"));
    } catch { /* nothing saved */ }
  }, [key]);
  const toggle = (index: number) => setDone((current) => {
    const next = current.includes(index) ? current.filter((item) => item !== index) : [...current, index];
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* not remembered */ }
    return next;
  });
  return <section className="panel prep-checklist">
    <span className="eyebrow">Antes da conversa · {done.length}/{ITEMS.length}</span>
    {ITEMS.map((item, index) => <label className="check-row" key={item}><input type="checkbox" checked={done.includes(index)} onChange={() => toggle(index)}/><span>{item}</span></label>)}
  </section>;
}
