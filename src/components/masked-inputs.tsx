"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

// The picker opened by the calendar button (same idea as PrimeReact's DatePicker): in "month" mode
// a year with its 12 months, in "day" mode a month with its days. Typing in the field still works.
function CalendarPopover({ mode, selected, min, max, onPick, onClose }: { mode: DateMode; selected: string; min?: string; max?: string; onPick: (iso: string) => void; onClose: () => void }) {
  const base = selected || max || new Date().toISOString().slice(0, 10);
  const [year, setYear] = useState(Number(base.slice(0, 4)));
  const [month, setMonth] = useState(Number(base.slice(5, 7)) - 1);
  const outOfRange = (iso: string) => Boolean((min && iso < min.slice(0, iso.length)) || (max && iso > max.slice(0, iso.length)));
  const shift = (step: number) => {
    if (mode === "month") { setYear((value) => value + step); return; }
    const next = month + step;
    setMonth((next + 12) % 12);
    if (next < 0) setYear((value) => value - 1); else if (next > 11) setYear((value) => value + 1);
  };
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return <div className="date-popover" role="dialog" aria-label={mode === "month" ? "Escolher mês e ano" : "Escolher data"} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
    <div className="date-popover-head">
      <button type="button" onClick={() => shift(-1)} aria-label={mode === "month" ? "Ano anterior" : "Mês anterior"}>‹</button>
      {mode === "month"
        ? <input className="date-popover-year" type="text" inputMode="numeric" value={year} aria-label="Ano" onChange={(event) => { const value = Number(event.target.value.replace(/\D/g, "").slice(0, 4)); if (value) setYear(value); }}/>
        : <strong>{MONTHS_LONG[month]} {year}</strong>}
      <button type="button" onClick={() => shift(1)} aria-label={mode === "month" ? "Próximo ano" : "Próximo mês"}>›</button>
    </div>
    {mode === "month"
      ? <div className="date-popover-months">{MONTHS_SHORT.map((label, index) => { const iso = `${year}-${pad(index + 1)}`; return <button type="button" key={label} disabled={outOfRange(iso)} className={selected.slice(0, 7) === iso ? "is-selected" : undefined} onClick={() => onPick(`${iso}-01`)}>{label}</button>; })}</div>
      : <div className="date-popover-days">
          {WEEKDAYS.map((label, index) => <span key={index} className="date-popover-weekday">{label}</span>)}
          {Array.from({ length: firstWeekday }, (_, index) => <span key={`gap-${index}`}/>)}
          {Array.from({ length: daysInMonth }, (_, index) => { const iso = `${year}-${pad(month + 1)}-${pad(index + 1)}`; return <button type="button" key={iso} disabled={outOfRange(iso)} className={selected === iso ? "is-selected" : undefined} onClick={() => onPick(iso)}>{index + 1}</button>; })}
        </div>}
  </div>;
}

// monthValue: in "month" mode, send "YYYY-MM" (sign-up) or "YYYY-MM-01" (fields stored as dates).
export function DateTextInput({ id, name, mode = "day", defaultValue, required, min, max, onValue, label, monthValue = "month" }: {
  id: string; name: string; mode?: DateMode; defaultValue?: string | null; required?: boolean;
  min?: string; max?: string; onValue?: (iso: string) => void; label?: string; monthValue?: "month" | "first-day";
}) {
  const [text, setText] = useState(() => isoToText(defaultValue, mode));
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const size = mode === "day" ? 8 : 6;
  const sizes = mode === "day" ? [2, 2, 4] : [2, 4];
  // Close the picker on a click outside it.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const digits = text.replace(/\D/g, "");
  const complete = digits.length === size;
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
  // The visible field stays invalid while the value is incomplete or not allowed, so a step's
  // "Continuar" (checkValidity) stops here and the browser points at this field.
  const field = useRef<HTMLInputElement>(null);
  const invalidMessage = text && !complete ? (mode === "day" ? "Complete o dia, o mês e o ano (dd/mm/aaaa)." : "Complete o mês e o ano (mm/aaaa).") : problem ?? "";
  useEffect(() => { field.current?.setCustomValidity(invalidMessage); }, [invalidMessage]);
  const apply = (raw: string) => {
    const next = mask(raw.replace(/\D/g, "").slice(0, size), sizes, "/");
    setText(next);
    const d = next.replace(/\D/g, "");
    if (onValue) onValue(d.length === size ? (mode === "day" ? `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}` : `${d.slice(2)}-${d.slice(0, 2)}-01`) : "");
  };
  const pick = (pickedIso: string) => {
    const [y, m, d] = pickedIso.split("-");
    apply(mode === "day" ? `${d}${m}${y}` : `${m}${y}`);
    setOpen(false);
  };
  return <div className="date-field" ref={wrapper}>
    <input ref={field} className="input masked-input" id={id} inputMode="numeric" autoComplete="off" required={required}
      placeholder={mode === "day" ? "dd/mm/aaaa" : "mm/aaaa"} maxLength={mode === "day" ? 10 : 7} value={text}
      aria-label={label} aria-invalid={problem ? true : undefined}
      onChange={(event) => apply(event.target.value)}
      onInvalid={(event) => { if (!text) event.currentTarget.setCustomValidity(mode === "day" ? "Digite a data (dd/mm/aaaa)." : "Digite o mês e o ano (mm/aaaa)."); }}/>
    <button type="button" className="date-field-button" aria-label={mode === "day" ? "Abrir calendário" : "Escolher mês e ano"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <CalendarDays size={17} aria-hidden="true"/>
    </button>
    {open && <CalendarPopover mode={mode} selected={iso} min={min} max={max} onPick={pick} onClose={() => setOpen(false)}/>}
    {problem && <small className="field-problem">{problem}</small>}
    <input type="hidden" name={name} value={mode === "month" && iso && monthValue === "month" ? iso.slice(0, 7) : iso}/>
  </div>;
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
