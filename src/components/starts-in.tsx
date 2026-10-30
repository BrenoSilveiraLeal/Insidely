"use client";

import { useEffect, useState } from "react";

const BRASILIA = "America/Sao_Paulo";

function remaining(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes >= 48 * 60) return `em ${Math.floor(minutes / 1440)} dias`;
  if (minutes >= 60) return `em ${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}min`;
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `em ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Live countdown to a conversation, plus the time in the viewer's own zone when it is not Brasília
// (the whole site shows Brasília time). Renders nothing until mounted, so server and client agree.
export function StartsIn({ startsAt, durationMinutes }: { startsAt: string; durationMinutes: number }) {
  const [now, setNow] = useState<number | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  useEffect(() => {
    // The clock and the browser's time zone only exist on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (now === null) return null;
  const start = new Date(startsAt).getTime();
  const end = start + durationMinutes * 60_000;
  if (now > end) return null;
  const soon = start - now < 60 * 60_000;
  const localTime = zone && zone !== BRASILIA ? new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(start)) : null;
  return <span className={`starts-in${now >= start ? " starts-in-live" : soon ? " starts-in-soon" : ""}`}>
    {now >= start ? "Acontecendo agora" : `Começa ${remaining(start - now)}`}
    {localTime && <small> · {localTime} no seu horário</small>}
  </span>;
}
