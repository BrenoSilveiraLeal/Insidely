"use client";
import Image from "next/image";
import { ImagePlus, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { removeProfileCoverAction, updateProfileCoverAction } from "@/app/actions";
import { TimedMessage } from "@/components/timed-message";

async function submitCover(_: { text?: string; at: number } | undefined, formData: FormData) { return { text: await updateProfileCoverAction(undefined, formData), at: Date.now() }; }

// The cover shows as a wide band behind the public profile header, so it is cropped to 3:1.
const COVER_WIDTH = 1800;
const COVER_HEIGHT = 600;

export function ProfileCoverForm({ image }: { image?: string | null }) {
  const [result, action, pending] = useActionState(submitCover, undefined);
  const [hiddenAt, setHiddenAt] = useState(0);
  const [preview, setPreview] = useState(image ?? "");
  // Editor (same controls as the profile photo): zoom and position over a 3:1 frame.
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (draft.startsWith("blob:")) URL.revokeObjectURL(draft); }, [draft]);
  const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (draft.startsWith("blob:")) URL.revokeObjectURL(draft);
    setHiddenAt(result?.at ?? 0);
    setDraft(URL.createObjectURL(file));
    setZoom(1); setX(0); setY(0);
    setOpen(true);
  };
  const center = () => { setZoom(1); setX(0); setY(0); };
  const cancel = () => { setOpen(false); if (input.current) input.current.value = ""; };
  const crop = async () => {
    const img = document.createElement("img");
    img.src = draft;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = COVER_WIDTH;
    canvas.height = COVER_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Same geometry as the preview: cover-fit, scaled around the centre, moved by x% / y% of the frame.
    const scale = Math.max(COVER_WIDTH / img.naturalWidth, COVER_HEIGHT / img.naturalHeight) * zoom;
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const drawX = Math.min(0, Math.max(COVER_WIDTH - w, (COVER_WIDTH - w) / 2 + (x / 100) * COVER_WIDTH));
    const drawY = Math.min(0, Math.max(COVER_HEIGHT - h, (COVER_HEIGHT - h) / 2 + (y / 100) * COVER_HEIGHT));
    ctx.drawImage(img, drawX, drawY, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || !input.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "capa.jpg", { type: "image/jpeg" }));
    input.current.files = transfer.files;
    setPreview(URL.createObjectURL(blob));
    setOpen(false);
  };
  return <section className="panel profile-cover-panel">
    <div className="profile-cover-heading"><div className="profile-cover-preview">{preview ? <Image src={preview} alt="Prévia da capa" fill sizes="560px" unoptimized /> : <ImagePlus size={28} />}</div><div><span className="eyebrow">Capa do perfil</span><h2>Escolha uma imagem para representar sua trajetória.</h2><p className="muted">JPG, PNG ou WEBP de até 5 MB. Depois de escolher, você ajusta o zoom e a posição. A moderação também se aplica à capa.</p></div></div>
    <form action={action} className="upload-row"><input ref={input} className="file-input" id="profile-cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp" required onChange={choose} /><label className="button button-ghost" htmlFor="profile-cover"><ImagePlus size={16}/>{preview ? "Trocar capa" : "Escolher capa"}</label>{draft && !open && <button type="button" className="button button-ghost" onClick={() => setOpen(true)}>Ajustar</button>}{preview && <button type="submit" formAction={removeProfileCoverAction} formNoValidate className="button button-ghost"><Trash2 size={16}/>Remover</button>}<button className="button button-dark" disabled={pending}>{pending ? "Salvando…" : "Salvar capa"}</button></form>
    {result?.text && result.at !== hiddenAt && <TimedMessage key={result.at} text={result.text} error={result.text !== "Capa atualizada."}/>}
    {open && <div className="image-editor-backdrop" role="dialog" aria-modal="true" aria-labelledby="cover-crop-title"><div className="image-editor-modal"><header><h2 id="cover-crop-title">Ajustar capa</h2><button type="button" className="image-editor-close" aria-label="Fechar editor" onClick={cancel}><X/></button></header>
      <div className="image-editor-body"><div className="image-editor-canvas"><div className="image-editor-crop image-editor-crop-wide"><Image src={draft} alt="Prévia do recorte da capa" fill sizes="600px" unoptimized style={{ objectFit: "cover", objectPosition: "center", transformOrigin: "center", transform: `translate(${x}%,${y}%) scale(${zoom})` }}/></div></div>
        <aside className="image-editor-controls"><label>Zoom<input aria-label="Zoom da capa" type="range" min="1" max="3" step=".05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/></label><label>Horizontal<input aria-label="Posição horizontal" type="range" min="-25" max="25" value={x} onChange={(event) => setX(Number(event.target.value))}/></label><label>Vertical<input aria-label="Posição vertical" type="range" min="-25" max="25" value={y} onChange={(event) => setY(Number(event.target.value))}/></label><button type="button" className="button button-ghost button-sm" onClick={center}>Centralizar</button></aside></div>
      <footer><button type="button" className="button button-ghost" onClick={cancel}>Cancelar</button><button type="button" className="button button-accent" onClick={crop}>Usar esta imagem</button></footer></div></div>}
  </section>;
}
