"use client";

import { useState } from "react";

// Dates and times are typed, not picked: "dd/mm/aaaa", "mm/aaaa" or "hh:mm", with the slashes and
// colon added while typing. The visible field is only for people; the form gets one ISO value
// ("YYYY-MM-DD", "YYYY-MM-01" or "HH:MM") in a hidden input under `name`, empty while incomplete.
type DateMode = "day" | "month";

const pad = (value: number) => String(value).padStart(2, "0");

function isoToText(iso: string | null | undefined, mode: DateMode) {
  const match = (iso ?? "").match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return "";
  return mode === "day" ? `${match[3] ?? "01"}/${match[2]}/${match[1]}` : `${match[2]}/${match[1]}`;
}

function mask(digits: string, sizes: number[], separator: string) {
  const parts: string[] = [];
  let rest = digits;
  for (const size of sizes) { if (!rest) break; parts.push(rest.slice(0, size)); rest = rest.slice(size); }
  return parts.join(separator);
}

// monthValue: in "month" mode, send "YYYY-MM" (sign-up) or "YYYY-MM-01" (fields stored as dates).
export function DateTextInput({ id, name, mode = "day", defaultValue, required, min, max, onValue, label, monthValue = "month" }: {
  id: string; name: string; mode?: DateMode; defaultValue?: string | null; required?: boolean;
  min?: string; max?: string; onValue?: (iso: string) => void; label?: string; monthValue?: "month" | "first-day";
}) {
  const [text, setText] = useState(() => isoToText(defaultValue, mode));
  const sizes = mode === "day" ? [2, 2, 4] : [2, 4];
  const digits = text.replace(/\D/g, "");
  const complete = digits.length === (mode === "day" ? 8 : 6);
  let iso = "", problem: string | null = null;
  if (complete) {
    const day = mode === "day" ? Number(digits.slice(0, 2)) : 1;
    const month = Number(mode === "day" ? digits.slice(2, 4) : digits.slice(0, 2));
    const year = Number(digits.slice(-4));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (month < 1 || month > 12) problem = "Mês inválido.";
    else if (date.getUTCDate() !== day) problem = "Dia inválido para esse mês.";
    else if (year < 1900) problem = "Ano inválido.";
    else {
      iso = `${year}-${pad(month)}-${pad(day)}`;
      const compare = mode === "day" ? iso : iso.slice(0, 7);
      if (min && compare < min.slice(0, compare.length)) problem = mode === "day" ? "Essa data já passou." : "Data muito antiga.";
      else if (max && compare > max.slice(0, compare.length)) problem = mode === "day" ? "Data muito distante." : "Esse mês ainda não chegou.";
      if (problem) iso = "";
    }
  }
  return <>
    <input className="input masked-input" id={id} inputMode="numeric" autoComplete="off" required={required}
      placeholder={mode === "day" ? "dd/mm/aaaa" : "mm/aaaa"} maxLength={mode === "day" ? 10 : 7} value={text}
      aria-label={label} aria-invalid={problem ? true : undefined}
      onChange={(event) => {
        const next = mask(event.target.value.replace(/\D/g, "").slice(0, mode === "day" ? 8 : 6), sizes, "/");
        setText(next);
        const nextDigits = next.replace(/\D/g, "");
        if (onValue) onValue(nextDigits.length === (mode === "day" ? 8 : 6) ? (mode === "day" ? `${nextDigits.slice(4)}-${nextDigits.slice(2, 4)}-${nextDigits.slice(0, 2)}` : `${nextDigits.slice(2)}-${nextDigits.slice(0, 2)}-01`) : "");
      }}
      onBlur={(event) => event.currentTarget.setCustomValidity(text && !complete ? (mode === "day" ? "Complete o dia, o mês e o ano (dd/mm/aaaa)." : "Complete o mês e o ano (mm/aaaa).") : problem ?? "")}
      onInvalid={(event) => { if (!text) event.currentTarget.setCustomValidity(mode === "day" ? "Digite a data (dd/mm/aaaa)." : "Digite o mês e o ano (mm/aaaa)."); }}
      onInput={(event) => event.currentTarget.setCustomValidity("")}/>
    {problem && <small className="field-problem">{problem}</small>}
    <input type="hidden" name={name} value={mode === "month" && iso && monthValue === "month" ? iso.slice(0, 7) : iso}/>
  </>;
}

export function TimeTextInput({ id, name, defaultValue, required, onValue, label }: { id: string; name?: string; defaultValue?: string; required?: boolean; onValue?: (time: string) => void; label?: string }) {
  const [text, setText] = useState(defaultValue ?? "");
  const digits = text.replace(/\D/g, "");
  const hours = Number(digits.slice(0, 2)), minutes = Number(digits.slice(2, 4));
  const complete = digits.length === 4;
  const problem = complete && (hours > 23 || minutes > 59) ? "Horário inválido." : null;
  const value = complete && !problem ? `${digits.slice(0, 2)}:${digits.slice(2, 4)}` : "";
  return <>
    <input className="input masked-input" id={id} inputMode="numeric" autoComplete="off" required={required} placeholder="hh:mm" maxLength={5} value={text}
      aria-label={label} aria-invalid={problem ? true : undefined}
      onChange={(event) => {
        const next = mask(event.target.value.replace(/\D/g, "").slice(0, 4), [2, 2], ":");
        setText(next);
        const d = next.replace(/\D/g, "");
        if (onValue) onValue(d.length === 4 && Number(d.slice(0, 2)) <= 23 && Number(d.slice(2)) <= 59 ? `${d.slice(0, 2)}:${d.slice(2)}` : "");
      }}
      onBlur={(event) => event.currentTarget.setCustomValidity(text && !complete ? "Complete o horário (hh:mm)." : problem ?? "")}
      onInvalid={(event) => { if (!text) event.currentTarget.setCustomValidity("Digite o horário (hh:mm)."); }}
      onInput={(event) => event.currentTarget.setCustomValidity("")}/>
    {problem && <small className="field-problem">{problem}</small>}
    {name && <input type="hidden" name={name} value={value}/>}
  </>;
}
