"use client";

import { MapPin } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

// State capitals come first among the suggestions ("S" → São Paulo, Salvador...).
const CAPITALS = new Set(["Rio Branco, AC", "Maceió, AL", "Macapá, AP", "Manaus, AM", "Salvador, BA", "Fortaleza, CE", "Brasília, DF", "Vitória, ES", "Goiânia, GO", "São Luís, MA", "Cuiabá, MT", "Campo Grande, MS", "Belo Horizonte, MG", "Belém, PA", "João Pessoa, PB", "Curitiba, PR", "Recife, PE", "Teresina, PI", "Rio de Janeiro, RJ", "Natal, RN", "Porto Alegre, RS", "Porto Velho, RO", "Boa Vista, RR", "Florianópolis, SC", "São Paulo, SP", "Aracaju, SE", "Palmas, TO"]);
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

let citiesPromise: Promise<string[]> | null = null;
// The list of Brazilian municipalities (IBGE, public/data/cidades.json) loads once, on first focus.
function loadCities() {
  citiesPromise ??= fetch("/data/cidades.json").then((response) => response.json() as Promise<string[]>).catch(() => { citiesPromise = null; return []; });
  return citiesPromise;
}

function suggest(cities: string[], query: string) {
  const q = plain(query);
  if (!q) return [];
  const starts: string[] = [], contains: string[] = [];
  for (const city of cities) {
    const name = plain(city);
    if (name.startsWith(q)) starts.push(city); else if (name.includes(q)) contains.push(city);
  }
  starts.sort((a, b) => Number(CAPITALS.has(b)) - Number(CAPITALS.has(a)));
  return [...starts, ...contains].slice(0, 4);
}

// "Cidade, UF" with suggestions from the official list while typing; the value has to be one of them.
export function CityInput({ id, name, defaultValue = "", required, placeholder = "Comece a digitar sua cidade" }: { id: string; name: string; defaultValue?: string; required?: boolean; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [cities, setCities] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const options = open ? suggest(cities, value) : [];
  const known = cities.length > 0 && cities.includes(value);
  // Typed text that is not a city from the list blocks the form, with a clear message.
  useEffect(() => {
    input.current?.setCustomValidity(value && cities.length && !known && value !== defaultValue ? "Escolha uma cidade da lista de sugestões." : "");
  }, [value, cities.length, known, defaultValue]);
  const pick = (city: string) => { setValue(city); setOpen(false); };
  return <div className="city-input">
    <MapPin size={16} className="city-input-icon" aria-hidden="true"/>
    <input ref={input} className="input" id={id} name={name} value={value} required={required} placeholder={placeholder} autoComplete="off"
      role="combobox" aria-expanded={options.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={options.length ? `${listId}-${active}` : undefined}
      onFocus={() => { void loadCities().then(setCities); setOpen(true); }}
      onChange={(event) => { setValue(event.target.value); setActive(0); setOpen(true); }}
      onBlur={() => setTimeout(() => setOpen(false), 120)}
      onKeyDown={(event) => {
        if (!options.length) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => (index + 1) % options.length); }
        else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => (index - 1 + options.length) % options.length); }
        else if (event.key === "Enter") { event.preventDefault(); pick(options[active]); }
        else if (event.key === "Escape") setOpen(false);
      }}/>
    {options.length > 0 && <ul className="city-input-list" id={listId} role="listbox">
      {options.map((city, index) => <li key={city} id={`${listId}-${index}`} role="option" aria-selected={index === active} className={index === active ? "is-active" : undefined} onMouseDown={(event) => { event.preventDefault(); pick(city); }} onMouseEnter={() => setActive(index)}>
        <span>{city.slice(0, city.lastIndexOf(","))}</span><small>{city.slice(city.lastIndexOf(",") + 2)}</small>
      </li>)}
    </ul>}
  </div>;
}
