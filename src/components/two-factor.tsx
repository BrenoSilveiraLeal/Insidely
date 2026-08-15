"use client";

import Image from "next/image";
import { Check, Copy, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useActionState, useEffect, useState } from "react";
import { enableTwoFactorAction, disableTwoFactorAction } from "@/app/actions";

function DigitInput({ name = "code" }: { name?: string }) {
  const [value, setValue] = useState("");
  return <><input className="otp-hidden" name={name} value={value} onChange={() => {}} /><div className="otp-digits">{Array.from({ length: 6 }, (_, index) => <input key={index} aria-label={`Dígito ${index + 1}`} className="otp-cell" inputMode="numeric" maxLength={1} value={value[index] ?? ""} onChange={(event) => { const char = event.target.value.replace(/\D/g, "").slice(-1); const next = `${value.slice(0, index)}${char}${value.slice(index + 1)}`.slice(0, 6); setValue(next); if (char) document.querySelector<HTMLInputElement>(`[data-otp-index="${index + 1}"]`)?.focus(); }} data-otp-index={index} onKeyDown={(event) => { if (event.key === "Backspace" && !value[index]) document.querySelector<HTMLInputElement>(`[data-otp-index="${index - 1}"]`)?.focus(); }} />)}</div></>;
}

export function TwoFactorSetup({ uri }: { uri: string }) {
  const [qr, setQr] = useState(""); const [state, action, pending] = useActionState(enableTwoFactorAction, undefined);
  useEffect(() => { QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#16213a", light: "#fffdf7" } }).then(setQr); }, [uri]);
  const success = state?.status === "success";
  const recoveryCodes = state?.recoveryCodes ?? [];
  return <section className={`panel two-factor-panel ${success ? "two-factor-success" : ""}`}><div className="two-factor-heading"><span className="verification-icon"><ShieldCheck size={25}/></span><div><span className="eyebrow">Proteção extra</span><h2>Google Authenticator</h2></div></div>{success ? <><div className="two-factor-done"><span className="two-factor-check"><Check size={34}/></span><h3>Authenticator conectado.</h3><p>Seu próximo login vai pedir a senha e o código de seis dígitos.</p></div><div className="recovery-box"><strong>Códigos de recuperação</strong><p>Guarde-os em um local seguro. Cada um funciona uma única vez caso você perca o celular.</p><div className="recovery-codes">{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button className="text-link" type="button" onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))}><Copy size={14}/> Copiar códigos</button></div></> : <form action={action} className="form-stack"><p className="muted">Abra o Google Authenticator, toque em <strong>+</strong> e escaneie este QR Code. Depois, confirme o código exibido.</p>{qr ? <Image className="two-factor-qr" src={qr} alt="QR Code para configurar o Google Authenticator" width={220} height={220} unoptimized/> : <div className="two-factor-qr loading">Gerando QR Code…</div>}<div className="field"><label>Digite o código de seis números</label><DigitInput/></div>{state?.status === "error" && <p className="form-error">{state.message}</p>}<button className="button button-accent" disabled={pending}>{pending ? "Verificando…" : "Ativar proteção"}</button></form>}</section>;
}

export function TwoFactorEnabled() { const [state, action, pending] = useActionState(disableTwoFactorAction, undefined); return <section className="panel two-factor-panel"><span className="eyebrow">Proteção ativa</span><h2>Authenticator conectado</h2><p className="muted">Sua conta pede um código temporário além da senha.</p><form className="form-stack" action={action}><div className="field"><label htmlFor="disable-two-factor-code">Código atual para desativar</label><input className="input" id="disable-two-factor-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required/></div><button className="button button-ghost" disabled={pending}>{pending ? "Desativando…" : "Desativar 2FA"}</button></form>{state?.status === "error" && <p className="form-error">{state.message}</p>}</section>; }
