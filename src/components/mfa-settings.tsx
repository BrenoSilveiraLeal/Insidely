"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { logoutAction } from "@/app/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Factor = { id: string; friendly_name?: string; status: string; factor_type: string };
type Pending = { id: string; qr: string; secret: string; uri: string };

export function MfaSettings({ challenge = false, continueTo = "/continuar" }: { challenge?: boolean; continueTo?: string }) {
  const [client] = useState(createSupabaseBrowserClient), router = useRouter();
  const [factors, setFactors] = useState<Factor[]>([]), [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null), [code, setCode] = useState("");
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null), [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState("");

  // `all` includes unverified factors left behind by an abandoned setup; `totp` only lists verified ones.
  const load = async () => {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error) setMessage({ text: "Não foi possível consultar o 2FA. Recarregue a página.", error: true });
    else setFactors(data.all.filter((factor) => factor.factor_type === "totp") as Factor[]);
    setLoaded(true);
    return data?.all ?? [];
  };
  useEffect(() => {
    let active = true;
    void client.auth.mfa.listFactors().then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage({ text: "Não foi possível consultar o 2FA. Recarregue a página.", error: true });
      else setFactors(data.all.filter((factor) => factor.factor_type === "totp") as Factor[]);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [client]);

  const verified = factors.filter((factor) => factor.status === "verified");

  const enroll = async () => {
    setBusy(true); setMessage(null);
    // A setup that was never confirmed blocks a new one with the same name: clear it first.
    for (const factor of (await load()).filter((item) => item.status !== "verified")) await client.auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `Insidely ${new Date().toLocaleDateString("pt-BR")}` });
    if (error) setMessage({ text: "Não foi possível iniciar a configuração. Tente novamente.", error: true });
    else setPending({ id: data.id, qr: await QRCode.toDataURL(data.totp.uri, { width: 220, margin: 1 }), secret: data.totp.secret, uri: data.totp.uri });
    setCode(""); setBusy(false);
  };

  const cancel = async () => {
    if (!pending) return;
    setBusy(true);
    await client.auth.mfa.unenroll({ factorId: pending.id });
    setPending(null); setCode(""); setMessage(null);
    await load(); setBusy(false);
  };

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const factorId = pending?.id ?? verified[0]?.id;
    if (!factorId) return;
    if (!/^\d{6}$/.test(code)) return setMessage({ text: "Digite os seis números do aplicativo autenticador.", error: true });
    setBusy(true);
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) {
      setMessage({ text: "Código inválido ou expirado. Confira o horário do celular e tente o código atual.", error: true });
      setCode(""); setBusy(false);
      return;
    }
    if (challenge) { router.replace(continueTo); router.refresh(); return; }
    setPending(null); setCode("");
    setMessage({ text: "2FA ativado. A partir de agora, o código será pedido ao entrar." });
    await load(); router.refresh(); setBusy(false);
  };

  const remove = async (id: string) => {
    if (confirmRemove !== id) return setConfirmRemove(id);
    setBusy(true); setConfirmRemove("");
    const { error } = await client.auth.mfa.unenroll({ factorId: id });
    setMessage(error ? { text: "Não foi possível desativar o 2FA. Entre novamente e tente outra vez.", error: true } : { text: "2FA desativado." });
    await load(); router.refresh(); setBusy(false);
  };

  const codeForm = (submitLabel: string) => <form className="form-stack" onSubmit={verify}>
    <label htmlFor="totp-code">Código de seis dígitos<input id="totp-code" className="input totp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>
    <button type="submit" className="button button-accent" disabled={busy || code.length !== 6}>{busy ? "Verificando…" : submitLabel}</button>
  </form>;

  return <section className="panel form-stack" aria-labelledby="mfa-title">
    <span className="eyebrow">Segurança da conta</span>
    <h2 id="mfa-title">{challenge ? "Confirme seu acesso" : "Autenticação em dois fatores"}</h2>
    <p className="muted">{challenge ? "Abra o aplicativo autenticador e informe o código atual." : "Use um aplicativo autenticador, como Google Authenticator ou Microsoft Authenticator. A configuração é opcional."}</p>
    {message && <p className={message.error ? "form-error" : "form-feedback"} role={message.error ? "alert" : "status"} aria-live="polite">{message.text}</p>}
    {!loaded && <p className="muted">Carregando…</p>}

    {challenge && loaded && (verified.length
      ? codeForm("Verificar código")
      : <p className="form-error" role="alert">Nenhum aplicativo autenticador ativo foi encontrado nesta conta.</p>)}
    {challenge && <form action={logoutAction}><button type="submit" className="button button-ghost button-sm">Sair e entrar com outra conta</button></form>}

    {!challenge && loaded && !pending && !verified.length && <button type="button" className="button button-dark" disabled={busy} onClick={enroll}>{busy ? "Preparando…" : "Configurar 2FA"}</button>}
    {!challenge && pending && <div className="mfa-setup form-stack">
      <ol className="mfa-steps">
        <li>No aplicativo autenticador, escaneie o QR Code abaixo.</li>
        <li>Está no celular? Toque em <a href={pending.uri}><u>abrir no aplicativo</u></a> ou copie a chave manual.</li>
        <li>Digite o código de seis dígitos que aparecer.</li>
      </ol>
      <Image className="mfa-qr" width={220} height={220} src={pending.qr} unoptimized alt="QR Code para configurar o aplicativo autenticador" />
      <div className="mfa-secret"><span>Chave manual</span><code>{pending.secret.match(/.{1,4}/g)?.join(" ")}</code><button type="button" className="button button-ghost button-sm" onClick={() => void navigator.clipboard?.writeText(pending.secret).then(() => setMessage({ text: "Chave copiada." }))}>Copiar</button></div>
      {codeForm("Confirmar e ativar")}
      <button type="button" className="button button-ghost button-sm" disabled={busy} onClick={cancel}>Cancelar configuração</button>
    </div>}
    {!challenge && verified.map((factor) => <div className="list-row" key={factor.id}>
      <span><strong>Aplicativo autenticador</strong> · ativo</span>
      <button type="button" className={confirmRemove === factor.id ? "button button-danger button-sm" : "button button-ghost button-sm"} disabled={busy} onClick={() => remove(factor.id)} onBlur={() => setConfirmRemove("")}>{confirmRemove === factor.id ? "Confirmar desativação" : "Desativar"}</button>
    </div>)}
  </section>;
}
