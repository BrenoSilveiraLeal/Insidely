"use client";

import { useId, useState } from "react";
import { catalogKey } from "@/lib/catalog";

type Option = { id: string; name: string };
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Type-ahead over the catalog: a few suggestions (4) that follow what is typed, never the whole list.
// Picking a listed name submits its id in `name`; a name that is not listed is submitted in
// `${name}Name` and goes to the admin queue (see recordCatalogRequests).
export function CatalogPicker({ name, label, options, kind, defaultId, defaultPendingName, required, id }: { name: string; label: string; options: Option[]; kind: "company" | "profession"; defaultId?: string; defaultPendingName?: string | null; required?: boolean; id?: string }) {
  const listId = useId();
  const inputId = id ?? `${listId}-input`;
  const initial = defaultPendingName ?? options.find((option) => option.id === defaultId)?.name ?? "";
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const match = options.find((option) => catalogKey(option.name) === catalogKey(text));
  const typed = text.trim().length >= 2 && !match;
  const noun = kind === "company" ? "empresa" : "área";
  const placeholder = kind === "company" ? "Empresa não cadastrada" : "Área não cadastrada";
  const q = plain(text);
  const suggestions = open && q && !match ? [...options.filter((option) => plain(option.name).startsWith(q)), ...options.filter((option) => !plain(option.name).startsWith(q) && plain(option.name).includes(q))].slice(0, 4) : [];
  const pick = (option: Option) => { setText(option.name); setOpen(false); };
  return <div className="field catalog-picker">
    <label htmlFor={inputId}>{label}</label>
    <div className="city-input suggest-input">
      <input className="input" id={inputId} value={text} required={required} autoComplete="off" placeholder={`Comece a digitar o nome da ${noun}`}
        role="combobox" aria-expanded={suggestions.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={suggestions.length ? `${listId}-${active}` : undefined}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => { setText(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (!suggestions.length) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % suggestions.length); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + suggestions.length) % suggestions.length); }
          else if (event.key === "Enter") { event.preventDefault(); pick(suggestions[active]); }
          else if (event.key === "Escape") setOpen(false);
        }}/>
      {suggestions.length > 0 && <ul className="city-input-list" id={listId} role="listbox">
        {suggestions.map((option, index) => <li key={option.id} id={`${listId}-${index}`} role="option" aria-selected={index === active} className={index === active ? "is-active" : undefined} onMouseDown={(event) => { event.preventDefault(); pick(option); }} onMouseEnter={() => setActive(index)}><span>{option.name}</span></li>)}
      </ul>}
    </div>
    <input type="hidden" name={name} value={match?.id ?? ""}/>
    <input type="hidden" name={`${name}Name`} value={typed ? text.trim() : ""}/>
    {typed && !suggestions.length && <small className="catalog-picker-note" role="status">“{text.trim()}” ainda não está cadastrada. Vai para análise da equipe e, até lá, seu perfil mostra “{placeholder}”.</small>}
  </div>;
}
