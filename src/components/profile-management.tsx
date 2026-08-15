"use client";

import { Camera, Trash2, Upload } from "lucide-react";
import { useActionState } from "react";
import { deleteAccountAction, submitVerificationAction, updateProfessionalProfileAction, updateProfileImageAction } from "@/app/actions";

export function ProfileImageForm({ image, name }: { image?: string | null; name: string }) {
  const [message, action, pending] = useActionState(updateProfileImageAction, undefined);
  return <section className="panel profile-photo-panel"><div className="profile-photo-heading"><span className="profile-photo" style={image ? { backgroundImage: `url(${image})` } : undefined}>{image ? null : name.slice(0,1).toUpperCase()}<Camera size={18}/></span><div><span className="eyebrow">Foto de perfil</span><h2>Mostre quem está por trás da experiência.</h2></div></div><form className="upload-row" action={action}><input className="file-input" id="profile-image" name="image" type="file" accept="image/png,image/jpeg,image/webp" required/><label className="button button-ghost" htmlFor="profile-image"><Upload size={16}/> Escolher foto</label><button className="button button-dark" disabled={pending}>{pending ? "Enviando…" : "Salvar foto"}</button></form>{message && <p className="form-feedback" role="status">{message}</p>}<p className="muted">JPG, PNG ou WEBP de até 3 MB. Consultores controlam a exibição pública em Privacidade.</p></section>;
}

export function VerificationRequestForm() {
  const [message, action, pending] = useActionState(submitVerificationAction, undefined);
  return <form className="verification-form" action={action}>
    <div className="field"><label htmlFor="method">Como você prefere comprovar?</label><select className="select" id="method" name="method" defaultValue="employment_document"><option value="company_email">E-mail corporativo</option><option value="employment_document">Documento de vínculo profissional</option><option value="professional_reference">Referência profissional verificável</option></select></div>
    <div className="field"><label htmlFor="document">Comprovante privado</label><input className="file-control" id="document" name="document" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required/><small>PDF, JPG, PNG ou WEBP de até 5 MB.</small></div>
    <div className="verification-note"><Upload size={18}/><span>O arquivo fica privado e é usado somente pela equipe de análise. No perfil público aparece apenas o resultado da verificação.</span></div>
    {message && <p className="form-feedback" role="status">{message}</p>}
    <button className="button button-accent" type="submit" disabled={pending}>{pending ? "Enviando com segurança…" : "Enviar para verificação"}</button>
  </form>;
}

type SelectOption = { id: string; name: string; category?: string };
type ProfessionalProfileValues = { headline: string; bio: string; location: string; region: string; workMode: string; seniority: string; yearsExperience: number; price30Cents: number; price60Cents: number; pixKey?: string | null; topics: string[]; boundaries: string[]; experiences: Array<{ companyId: string; professionId: string; title: string }> };

export function ProfessionalProfileForm({ profile, companies, professions }: { profile: ProfessionalProfileValues; companies: SelectOption[]; professions: SelectOption[] }) {
  const [message, action, pending] = useActionState(updateProfessionalProfileAction, undefined);
  const experience = profile.experiences[0];
  return <section className="panel professional-edit-panel"><span className="eyebrow">Perfil público de consultor</span><h2>O que as pessoas poderão conhecer sobre sua experiência.</h2><p className="muted">Esta área é diferente da conta de quem agenda conversas. Informações confidenciais não devem ser incluídas.</p><form action={action} className="form-stack" style={{marginTop:22}}>
    <div className="field"><label htmlFor="headline">Título profissional</label><input className="input" id="headline" name="headline" defaultValue={profile.headline} minLength={5} required/></div>
    <div className="field"><label htmlFor="bio">Apresentação</label><textarea className="textarea" id="bio" name="bio" defaultValue={profile.bio} minLength={30} required/></div>
    <div className="profile-form-grid"><div className="field"><label htmlFor="title">Cargo</label><input className="input" id="title" name="title" defaultValue={experience?.title ?? ""} minLength={2} required/></div><div className="field"><label htmlFor="companyId">Empresa ou experiência principal</label><select className="select" id="companyId" name="companyId" defaultValue={experience?.companyId ?? ""} required><option value="" disabled>Selecione</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></div><div className="field"><label htmlFor="professionId">Área de atuação</label><select className="select" id="professionId" name="professionId" defaultValue={experience?.professionId ?? ""} required><option value="" disabled>Selecione</option>{professions.map(profession=><option key={profession.id} value={profession.id}>{profession.name}</option>)}</select></div><div className="field"><label htmlFor="yearsExperience">Anos de experiência</label><input className="input" id="yearsExperience" name="yearsExperience" type="number" min="0" max="60" defaultValue={profile.yearsExperience} required/></div></div>
    <div className="profile-form-grid"><div className="field"><label htmlFor="location">Cidade/UF</label><input className="input" id="location" name="location" defaultValue={profile.location} required/></div><div className="field"><label htmlFor="region">País ou região</label><input className="input" id="region" name="region" defaultValue={profile.region} required/></div><div className="field"><label htmlFor="workMode">Modelo de trabalho</label><select className="select" id="workMode" name="workMode" defaultValue={profile.workMode}><option value="REMOTE">Remoto</option><option value="HYBRID">Híbrido</option><option value="ONSITE">Presencial</option></select></div><div className="field"><label htmlFor="seniority">Nível</label><select className="select" id="seniority" name="seniority" defaultValue={profile.seniority}><option value="INTERN">Estágio</option><option value="JUNIOR">Júnior</option><option value="MID">Pleno</option><option value="SENIOR">Sênior</option><option value="LEAD">Liderança técnica</option><option value="MANAGER">Gestão</option></select></div></div>
    <div className="profile-form-grid"><div className="field"><label htmlFor="price30Cents">Valor por 30 min (centavos)</label><input className="input" id="price30Cents" name="price30Cents" type="number" min="1000" step="100" defaultValue={profile.price30Cents} required/></div><div className="field"><label htmlFor="price60Cents">Valor por 60 min (centavos)</label><input className="input" id="price60Cents" name="price60Cents" type="number" min="1000" step="100" defaultValue={profile.price60Cents} required/></div></div>
    <div className="field"><label htmlFor="pixKey">Chave Pix para pagamento direto</label><input className="input" id="pixKey" name="pixKey" defaultValue={profile.pixKey ?? ""} placeholder="CPF, e-mail, telefone ou chave aleatória"/><small>O QR Code envia o pagamento diretamente para você. A chave nunca aparece no perfil público.</small></div>
    <div className="field"><label htmlFor="topics">Temas que você pode conversar</label><input className="input" id="topics" name="topics" defaultValue={profile.topics.join(", ")} required/><small>Separe os temas por vírgulas.</small></div>
    <div className="field"><label htmlFor="boundaries">Limites da conversa</label><input className="input" id="boundaries" name="boundaries" defaultValue={profile.boundaries.join(", ")} required/><small>Ex.: dados confidenciais, informações de terceiros.</small></div>
    {message && <p className="form-feedback" role="status">{message}</p>}<button className="button button-dark" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar perfil profissional"}</button>
  </form></section>;
}

export function AccountDangerZone({ email }: { email: string }) {
  return <section className="panel danger-zone"><span className="eyebrow">Controle da conta</span><h2>Excluir minha conta</h2><p>Esta ação remove seu perfil e os dados vinculados. Para confirmar, digite seu e-mail completo.</p><form action={deleteAccountAction} className="form-stack"><div className="field"><label htmlFor="confirmation">Confirme com {email}</label><input className="input" id="confirmation" name="confirmation" type="email" autoComplete="off" required/></div><button className="button danger-button" type="submit"><Trash2 size={16}/> Excluir conta definitivamente</button></form></section>;
}
