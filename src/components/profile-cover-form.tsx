"use client";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { removeProfileCoverAction, updateProfileCoverAction } from "@/app/actions";

export function ProfileCoverForm({ image }: { image?: string | null }) {
  const [message, action, pending] = useActionState(updateProfileCoverAction, undefined);
  const [preview, setPreview] = useState(image ?? "");
  return <section className="panel profile-cover-panel"><div className="profile-cover-heading"><div className="profile-cover-preview">{preview ? <Image src={preview} alt="Prévia da capa" fill sizes="560px" unoptimized /> : <ImagePlus size={28} />}</div><div><span className="eyebrow">Capa do perfil</span><h2>Escolha uma imagem para representar sua trajetória.</h2><p className="muted">JPG, PNG ou WEBP de até 5 MB. A moderação também se aplica à capa.</p></div></div><form action={action} className="upload-row"><input className="file-input" id="profile-cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp" required onChange={event => { const file = event.currentTarget.files?.[0]; if (file) setPreview(URL.createObjectURL(file)); }} /><label className="button button-ghost" htmlFor="profile-cover"><ImagePlus size={16}/>{preview ? "Trocar capa" : "Escolher capa"}</label>{preview&&<button type="submit" formAction={removeProfileCoverAction} formNoValidate className="button button-ghost"><Trash2 size={16}/>Remover</button>}<button className="button button-dark" disabled={pending}>{pending ? "Salvando…" : "Salvar capa"}</button></form>{message&&<p className="form-feedback" role="status">{message}</p>}</section>;
}
