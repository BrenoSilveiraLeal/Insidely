"use client";
import { useState } from "react";
import { displayPixKey, maskPixKey, normalizePixKey, PIX_KEY_TYPES, pixKeyError, type PixKeyType } from "@/lib/pix-key";

const FIELD: Record<PixKeyType, { placeholder: string; inputMode: "numeric" | "tel" | "email" | "text"; type: string; maxLength: number }> = {
  CPF: { placeholder: "000.000.000-00", inputMode: "numeric", type: "text", maxLength: 14 },
  PHONE: { placeholder: "(00) 00000-0000", inputMode: "tel", type: "tel", maxLength: 15 },
  EMAIL: { placeholder: "voce@email.com", inputMode: "email", type: "email", maxLength: 77 },
  RANDOM: { placeholder: "Cole aqui a chave que o banco gerou", inputMode: "text", type: "text", maxLength: 36 },
};

// First the kind of key, then a field shaped for it (CPF and phone get their dots, dashes and DDD
// while typing). The browser blocks saving while the key is incomplete; the server checks it again.
export function PixKeyField({ defaultValue }: { defaultValue?: string | null }) {
  const [initial] = useState(() => displayPixKey(defaultValue));
  const [type, setType] = useState<PixKeyType>(initial.type);
  const [text, setText] = useState(initial.text);
  const [touched, setTouched] = useState(false);
  const valid = normalizePixKey(type, text) !== null;
  const field = FIELD[type];
  const choose = (next: PixKeyType) => { if (next === type) return; setType(next); setText(""); setTouched(false); };
  return <div className="field pix-key-field">
    <span className="field-label" id="profile-pix-type">Chave Pix para receber</span>
    <div className="employment-choice pix-key-types" role="radiogroup" aria-labelledby="profile-pix-type">
      {PIX_KEY_TYPES.map((item) => <label key={item.value} className={type === item.value ? "is-selected" : undefined}><input type="radio" name="pixKeyType" value={item.value} checked={type === item.value} onChange={() => choose(item.value)}/>{item.label}</label>)}
    </div>
    <label className="sr-only" htmlFor="profile-pix">{PIX_KEY_TYPES.find((item) => item.value === type)?.label}</label>
    <input className="input" id="profile-pix" name="pixKey" type={field.type} inputMode={field.inputMode} maxLength={field.maxLength} autoComplete="off" placeholder={field.placeholder} value={text} required
      aria-invalid={touched && !valid ? true : undefined} aria-describedby="profile-pix-help"
      ref={(input) => input?.setCustomValidity(text && !valid ? pixKeyError(type) : "")}
      onChange={(event) => setText(maskPixKey(type, event.target.value))} onBlur={() => setTouched(true)}/>
    {touched && text && !valid ? <small className="pix-key-error" id="profile-pix-help" role="alert">{pixKeyError(type)}</small> : <small className="muted" id="profile-pix-help">Use uma chave cadastrada no seu banco, no seu nome. É para onde vai o valor das suas conversas e não aparece no perfil.</small>}
  </div>;
}
