"use client";

import { useActionState, useState } from "react";
import { completeOnboardingAction } from "@/app/actions";

type Option = { id: string; name: string };

export function OnboardingForm({ firstName, initialRole, companies, professions }: { firstName: string; initialRole: "USER" | "CONSULTANT"; companies: Option[]; professions: Option[] }) {
  const [role, setRole] = useState(initialRole);
  const [error, action, pending] = useActionState(completeOnboardingAction, undefined);
  const consultant = role === "CONSULTANT";
  return <form action={action} className="auth-form form-stack">
    <span className="eyebrow">Olá, {firstName}</span><h2>{consultant ? "Monte seu perfil profissional." : "Prepare sua conta."}</h2>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="field"><label htmlFor="role">Como você quer participar?</label><select className="select" id="role" name="role" value={role} onChange={(event)=>setRole(event.target.value as "USER"|"CONSULTANT")}><option value="USER">Quero conversar com profissionais</option><option value="CONSULTANT">Quero compartilhar experiência</option></select></div>
    {consultant ? <>
      <div className="field"><label htmlFor="headline">Título profissional</label><input className="input" id="headline" name="headline" placeholder="Ex.: Product Designer em fintech" required/></div>
      <div className="field"><label htmlFor="title">Cargo atual ou mais recente</label><input className="input" id="title" name="title" placeholder="Ex.: Analista de Produto" required/></div>
      <div className="field"><label htmlFor="companyId">Empresa</label><select className="select" id="companyId" name="companyId" defaultValue="" required><option value="" disabled>Selecione</option>{companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="professionId">Área ou profissão</label><select className="select" id="professionId" name="professionId" defaultValue="" required><option value="" disabled>Selecione</option>{professions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
      <div className="field"><label htmlFor="yearsExperience">Anos de experiência</label><input className="input" id="yearsExperience" name="yearsExperience" type="number" min="0" max="60" required/></div>
      <div className="field"><label htmlFor="location">Localização</label><input className="input" id="location" name="location" placeholder="Cidade, UF" required/></div>
      <div className="field"><label htmlFor="bio">O que você pode contextualizar?</label><textarea className="textarea" id="bio" name="bio" minLength={30} required/></div>
    </> : <div className="onboarding-note"><strong>Seu perfil será pessoal.</strong><span>Você poderá salvar profissionais, agendar conversas, pagar e acompanhar seus encontros.</span></div>}
    <button className="button button-accent" type="submit" disabled={pending}>{pending ? "Salvando…" : "Concluir cadastro"}</button>
  </form>;
}
