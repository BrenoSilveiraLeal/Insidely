"use client";
import { Check } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { verifySupabaseTwoFactorAction } from "@/app/actions";

export function TwoFactorChallenge() {
  const [state, action, pending] = useActionState(verifySupabaseTwoFactorAction, undefined);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"idle" | "error" | "success">("idle");
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => { if (state?.status === "error") { const reset = window.setTimeout(() => { setPhase("error"); setCode(""); }, 0); const focus = window.setTimeout(() => { setPhase("idle"); inputs.current[0]?.focus(); }, 700); return () => { window.clearTimeout(reset); window.clearTimeout(focus); }; } if (state?.status === "success") { const success = window.setTimeout(() => setPhase("success"), 0); return () => window.clearTimeout(success); } }, [state]);
  const update = (index: number, value: string) => { const digit = value.replace(/\D/g, "").slice(-1); const next = `${code.slice(0, index)}${digit}${code.slice(index + 1)}`.slice(0, 6); setCode(next); if (digit) inputs.current[Math.min(index + 1, 5)]?.focus(); };
  const paste = (event: React.ClipboardEvent<HTMLInputElement>) => { event.preventDefault(); const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); setCode(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus(); };
  const keyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => { if (event.key === "Backspace" && !code[index]) { event.preventDefault(); inputs.current[Math.max(index - 1, 0)]?.focus(); } if (event.key === "ArrowLeft") inputs.current[Math.max(index - 1, 0)]?.focus(); if (event.key === "ArrowRight") inputs.current[Math.min(index + 1, 5)]?.focus(); };
  return <form action={action} className={`auth-form form-stack mfa-challenge ${phase === "error" ? "mfa-error" : ""} ${phase === "success" ? "mfa-success" : ""}`}><span className="eyebrow">Verifica de seguran</span><h2>Confirme seu Authenticator.</h2><p className="muted">Digite o c exibido no Google Authenticator para continuar.</p><input type="hidden" name="code" value={code}/><div className="mfa-code-boxes" role="group" aria-label="C de seis n">{Array.from({ length: 6 }, (_, index) => <input key={index} ref={(element) => { inputs.current[index] = element; }} className="mfa-code-box" aria-label={`D ${index + 1} de 6`} inputMode="numeric" maxLength={1} value={code[index] ?? ""} onChange={(event) => update(index, event.target.value)} onPaste={paste} onKeyDown={(event) => keyDown(index, event)} autoFocus={index === 0}/>)}</div>{phase === "success" && <div className="mfa-confirmation" aria-live="polite"><Check size={24}/> C</div>}{state?.status === "error" && <p className="form-error" role="alert">{state.message}</p>}<button className="button button-accent button-block" disabled={pending || code.length !== 6}>{pending ? "Verificando." : "Confirmar c"}</button></form>;
}
