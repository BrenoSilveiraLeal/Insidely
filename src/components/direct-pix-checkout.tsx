"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { Check, Copy, QrCode } from "lucide-react";
import { useEffect, useState } from "react";

export function DirectPixCheckout({ payload }: { payload: string }) {
  const [qr, setQr] = useState(""); const [copied, setCopied] = useState(false);
  useEffect(() => { QRCode.toDataURL(payload, { margin: 1, width: 260, color: { dark: "#16213a", light: "#fffdf7" } }).then(setQr); }, [payload]);
  const copy = async () => { await navigator.clipboard.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return <div className="direct-pix"><div className="direct-pix-title"><QrCode size={21}/><strong>Pix para a Insidely</strong></div>{qr ? <Image className="direct-pix-qr" src={qr} alt="QR Code Pix da Insidely" width={260} height={260} unoptimized/> : <div className="direct-pix-qr loading">Gerando QR Code.</div>}<button className="button button-dark button-block" type="button" onClick={copy}>{copied ? <><Check size={16}/> Copiado</> : <><Copy size={16}/> Copiar Pix</>}</button><p className="muted">O valor será conferido pela Insidely e ficará retido até a conversa. Após a confirmação, o valor da conversa será repassado ao profissional.</p></div>;
}
