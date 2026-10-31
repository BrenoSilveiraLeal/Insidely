"use client";

import { useId, useState } from "react";

const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Text field with suggestions while typing (job title, area). Unlike the city field, any text is
// accepted: the list only helps people write the usual name.
export function SuggestInput({ id, name, options, defaultValue = "", required, placeholder }: { id?: string; name: string; options: string[]; defaultValue?: string; required?: boolean; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const q = plain(value);
  const matches = open && q ? [...options.filter((option) => plain(option).startsWith(q)), ...options.filter((option) => !plain(option).startsWith(q) && plain(option).includes(q))].filter((option) => plain(option) !== q).slice(0, 8) : [];
  const pick = (option: string) => { setValue(option); setOpen(false); };
  return <div className="city-input suggest-input">
    <input className="input" id={id} name={name} value={value} required={required} placeholder={placeholder} autoComplete="off"
      role="combobox" aria-expanded={matches.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={matches.length ? `${listId}-${active}` : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
      onChange={(event) => { setValue(event.target.value); setActive(0); setOpen(true); }}
      onKeyDown={(event) => {
        if (!matches.length) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % matches.length); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + matches.length) % matches.length); }
        else if (event.key === "Enter") { event.preventDefault(); pick(matches[active]); }
        else if (event.key === "Escape") setOpen(false);
      }}/>
    {matches.length > 0 && <ul className="city-input-list" id={listId} role="listbox">
      {matches.map((option, index) => <li key={option} id={`${listId}-${index}`} role="option" aria-selected={index === active} className={index === active ? "is-active" : undefined} onMouseDown={(event) => { event.preventDefault(); pick(option); }} onMouseEnter={() => setActive(index)}><span>{option}</span></li>)}
    </ul>}
  </div>;
}
