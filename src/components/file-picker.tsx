"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";

// A file field that reads as a button ("Enviar arquivo") and shows the chosen file's name.
export function FilePicker({ id, name, accept, hint, required }: { id: string; name: string; accept: string; hint: string; required?: boolean }) {
  const [file, setFile] = useState<string | null>(null);
  return <div className="file-picker">
    <input className="file-picker-input" id={id} name={name} type="file" accept={accept} required={required} onChange={(event) => setFile(event.target.files?.[0]?.name ?? null)}/>
    <label htmlFor={id} className="file-picker-button"><FileUp size={18} aria-hidden="true"/>{file ? "Trocar arquivo" : "Enviar arquivo"}</label>
    <span className={`file-picker-name${file ? " file-picker-chosen" : ""}`}>{file ?? "Nenhum arquivo escolhido"}</span>
    <small className="muted">{hint}</small>
  </div>;
}
