"use client";

import Link from "next/link";
import { useActionState } from "react";
import { becomeConsultantAction } from "@/app/actions";
import { KeepValuesForm } from "@/components/keep-values-form";
import { ConsultantProfileFields } from "@/components/onboarding-form";

type Option = { id: string; name: string };

export function BecomeConsultantForm({ companies, professions }: { companies: Option[]; professions: Option[] }) {
  const [error, action, pending] = useActionState(becomeConsultantAction, undefined);
  return <KeepValuesForm action={action} className="form-stack">
    {error && <p className="form-error" role="alert">{error}</p>}
    <ConsultantProfileFields companies={companies} professions={professions}/>
    <label className="check-row"><input name="terms" type="checkbox" required/><span>Li os <Link href="/termos" target="_blank"><u>Termos de Uso</u></Link> e as regras para consultores: falo da minha vivência, não represento a empresa e não compartilho informação confidencial.</span></label>
    <button className="button button-accent" type="submit" disabled={pending}>{pending ? "Criando perfil…" : "Criar meu perfil de consultor"}</button>
  </KeepValuesForm>;
}
