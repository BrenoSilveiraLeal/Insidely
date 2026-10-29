"use client";

import { useId, useState } from "react";
import { catalogKey } from "@/lib/catalog";

type Option = { id: string; name: string };
const OTHER = "Outra (não está na lista)";

// Type-ahead over the catalog. Picking a listed name submits its id in `name`; a name that is not
// listed is submitted in `${name}Name` and goes to the admin queue (see recordCatalogRequests).
export function CatalogPicker({ name, label, options, kind, defaultId, defaultPendingName, required, id }: { name: string; label: string; options: Option[]; kind: "company" | "profession"; defaultId?: string; defaultPendingName?: string | null; required?: boolean; id?: string }) {
  const listId = useId();
  const inputId = id ?? `${listId}-input`;
  const initial = defaultPendingName ?? options.find((option) => option.id === defaultId)?.name ?? "";
  const [text, setText] = useState(initial);
  const [other, setOther] = useState(Boolean(defaultPendingName));
  const match = options.find((option) => catalogKey(option.name) === catalogKey(text));
  const typed = text.trim().length >= 2 && !match;
  const noun = kind === "company" ? "empresa" : "área";
  const placeholder = kind === "company" ? "Empresa não cadastrada" : "Área não cadastrada";
  return <div className="field catalog-picker">
    <label htmlFor={inputId}>{label}</label>
    <input className="input" id={inputId} list={listId} value={text} required={required} autoComplete="off"
      placeholder={other ? `Digite o nome da ${noun}` : `Comece a digitar o nome da ${noun}`}
      onChange={(event) => { const value = event.target.value; if (value === OTHER) { setOther(true); setText(""); } else setText(value); }}/>
    <datalist id={listId}>{options.map((option) => <option key={option.id} value={option.name}/>)}<option value={OTHER}/></datalist>
    <input type="hidden" name={name} value={match?.id ?? ""}/>
    <input type="hidden" name={`${name}Name`} value={typed ? text.trim() : ""}/>
    {(typed || (other && !text)) && <small className="catalog-picker-note" role="status">{typed ? <>“{text.trim()}” ainda não está cadastrada. Ela vai para análise da equipe e, até ser aprovada, seu perfil mostra “{placeholder}”. Você já pode usar a plataforma normalmente.</> : `Digite o nome da ${noun} em que você trabalha.`}</small>}
  </div>;
}
