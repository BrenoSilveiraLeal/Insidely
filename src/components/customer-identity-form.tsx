"use client";

import { DateTextInput } from "@/components/masked-inputs";
import Link from "next/link";
import { useActionState } from "react";
import { saveCustomerIdentityAction } from "@/app/actions";
import { KeepValuesForm } from "@/components/keep-values-form";

function formatCpfInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

// Shared by onboarding, /identificacao (accounts created before the CPF was mandatory) and settings.
export function CustomerIdentityFields() {
  return <>
    <div className="field"><label htmlFor="cpf">CPF</label><input className="input" id="cpf" name="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" pattern="\d{3}\.?\d{3}\.?\d{3}-?\d{2}" maxLength={14} required onInput={(event) => { event.currentTarget.value = formatCpfInput(event.currentTarget.value); }}/></div>
    <div className="field"><label htmlFor="birthDate">Data de nascimento</label><DateTextInput id="birthDate" name="birthDate" required max={new Date().toISOString().slice(0, 10)}/><small className="muted">A Insidely é exclusiva para maiores de 18 anos.</small></div>
    <label className="check-row"><input name="identityConsent" type="checkbox" required/><span>Confirmo que os dados são meus. Eles ficam guardados com segurança pela Insidely e não aparecem no meu perfil. Quando eu abrir um chat, o consultor verá apenas o CPF parcialmente mascarado e a minha idade. O registro completo só é compartilhado mediante ordem judicial ou requisição de autoridade competente (<Link href="/privacidade" target="_blank"><u>Política de Privacidade</u></Link>).</span></label>
  </>;
}

export function CustomerIdentityForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(saveCustomerIdentityAction, undefined);
  return <KeepValuesForm action={action} className="form-stack">
    {next && <input type="hidden" name="next" value={next}/>}
    <CustomerIdentityFields/>
    {state && <p className={state.status === "error" ? "form-error" : "form-feedback"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    <button className="button button-accent" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar e continuar"}</button>
  </KeepValuesForm>;
}
