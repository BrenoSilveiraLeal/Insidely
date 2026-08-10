"use client";

import { Camera, Trash2, Upload } from "lucide-react";
import { useActionState } from "react";
import { deleteAccountAction, submitVerificationAction, updateProfileImageAction } from "@/app/actions";

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

export function AccountDangerZone({ email }: { email: string }) {
  return <section className="panel danger-zone"><span className="eyebrow">Controle da conta</span><h2>Excluir minha conta</h2><p>Esta ação remove seu perfil e os dados vinculados. Para confirmar, digite seu e-mail completo.</p><form action={deleteAccountAction} className="form-stack"><div className="field"><label htmlFor="confirmation">Confirme com {email}</label><input className="input" id="confirmation" name="confirmation" type="email" autoComplete="off" required/></div><button className="button danger-button" type="submit"><Trash2 size={16}/> Excluir conta definitivamente</button></form></section>;
}
