"use client";

import { CheckBox } from "@/components/check-box";
import { KeepValuesForm } from "@/components/keep-values-form";
import { PasswordChecklist } from "@/components/password-checklist";
import { RememberLogin } from "@/components/remember-login";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { changePasswordAction, loginAction, type LoginState, registerAction, requestPasswordResetAction, updatePasswordAction } from "@/app/actions";

function PasswordField({ name, label, autoComplete, minLength = 8, invalid, describedBy, onInput }: { name: string; label: string; autoComplete?: string; minLength?: number; invalid?: boolean; describedBy?: string; onInput?: () => void }) {
  const [visible, setVisible] = useState(false);
  return <label>{label}<span className="password-field"><input className="input" name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} required aria-invalid={invalid || undefined} aria-describedby={invalid ? describedBy : undefined} onInput={onInput} /><button type="button" className="password-toggle" aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? "Ocultar" : "Mostrar"}</button></span></label>;
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.27-2.09 3.57-5.17 3.57-8.64Z" /><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3A7.16 7.16 0 0 1 12 19.22a7.2 7.2 0 0 1-6.77-4.98H1.23v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.23 14.24a7.2 7.2 0 0 1 0-4.48v-3.1H1.23a12 12 0 0 0 0 10.68l4-3.1Z" /><path fill="#EA4335" d="M12 4.78a6.52 6.52 0 0 1 4.6 1.8l3.45-3.45A11.99 11.99 0 0 0 1.23 6.66l4 3.1A7.2 7.2 0 0 1 12 4.78Z" /></svg>;
}

function SocialButtons({ google }: { google: boolean }) {
  if (!google) return null;
  return <div className="social-grid"><Link prefetch={false} className="button social-button" href="/auth/google?next=/continuar"><GoogleMark /><span>Google</span></Link></div>;
}

function LoginAlert({ state, onUseSuggestion }: { state: NonNullable<LoginState>; onUseSuggestion: (email: string) => void }) {
  return <div className="login-alert" id="login-error" role="alert">
    <p>{state.message}</p>
    {(state.suggestion || state.hint) && <div className="login-alert-actions">
      {state.suggestion && <button type="button" className="button button-light button-sm" onClick={() => onUseSuggestion(state.suggestion!)}>Usar {state.suggestion}</button>}
      {state.hint === "help" && <Link className="button button-ghost button-sm" href="/recuperar-senha">Esqueci minha senha</Link>}
      {state.hint && <Link className="button button-ghost button-sm" href="/cadastro">Criar uma conta</Link>}
    </div>}
  </div>;
}

export function LoginForm({ google, socialPending = false, next = "/continuar" }: { google: boolean; socialPending?: boolean; next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  // The field stays marked until the person edits it after this error.
  const [edited, setEdited] = useState<{ state: LoginState; field: "email" | "password" } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const invalid = (field: "email" | "password") => state?.field === field && !(edited?.state === state && edited.field === field);
  const markEdited = (field: "email" | "password") => () => { if (state?.field === field) setEdited({ state, field }); };
  const applySuggestion = (email: string) => {
    if (!emailRef.current) return;
    emailRef.current.value = email;
    setEdited({ state, field: "email" });
    emailRef.current.form?.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
  };
  return <KeepValuesForm action={action} className="auth-form form-stack"><input type="hidden" name="next" value={next}/><span className="eyebrow">Acesso seguro</span><h2>Entre na sua conta.</h2>{state ? <LoginAlert state={state} onUseSuggestion={applySuggestion}/> : socialPending && <p className="form-error" role="alert">Não foi possível concluir o login social.</p>}<label htmlFor="login-email">E-mail</label><input ref={emailRef} className="input" id="login-email" name="email" type="email" autoComplete="username" required aria-invalid={invalid("email") || undefined} aria-describedby={invalid("email") ? "login-error" : undefined} onInput={markEdited("email")} /><PasswordField name="password" label="Senha" autoComplete="current-password" minLength={1} invalid={invalid("password")} describedBy="login-error" onInput={markEdited("password")} /><RememberLogin /><button type="submit" className="button button-accent button-block" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</button><Link href="/recuperar-senha"><u>Esqueci minha senha</u></Link><SocialButtons google={google} /><p>Não tem uma conta? <Link href="/cadastro"><u>Cadastre-se</u></Link></p></KeepValuesForm>;
}

export function RegisterForm({ google }: { google: boolean }) {
  const [error, action, pending] = useActionState(registerAction, undefined);
  return <KeepValuesForm action={action} className="auth-form form-stack"><h2>Crie sua conta.</h2>{error && <p className="form-error" role="alert">{error}</p>}<label htmlFor="register-name">Nome</label><input className="input" id="register-name" name="name" autoComplete="name" required /><label htmlFor="register-email">E-mail</label><input className="input" id="register-email" name="email" type="email" autoComplete="email" required /><PasswordField name="password" label="Senha" autoComplete="new-password" /><PasswordField name="confirmPassword" label="Confirmar senha" autoComplete="new-password" /><PasswordChecklist confirmName="confirmPassword" /><label htmlFor="register-role">Como deseja usar a plataforma?</label><select className="select" id="register-role" name="role"><option value="USER">Conversar com profissionais</option><option value="CONSULTANT">Compartilhar minha experiência</option></select><CheckBox name="terms" required>Li e concordo com os <Link href="/termos" target="_blank"><u>termos</u></Link>.</CheckBox><button type="submit" className="button button-accent button-block" disabled={pending}>{pending ? "Criando..." : "Criar conta"}</button><SocialButtons google={google} /></KeepValuesForm>;
}

export function PasswordRecoveryForm() { const [message, action, pending] = useActionState(requestPasswordResetAction, undefined); return <form action={action} className="auth-form form-stack"><h2>Esqueceu sua senha?</h2>{message && <p className="form-feedback" role="status">{message}</p>}<label>E-mail<input className="input" name="email" type="email" required /></label><button className="button button-accent button-block" disabled={pending}>{pending ? "Enviando…" : "Enviar link"}</button><Link href="/entrar">Voltar para entrar</Link></form>; }

export function NewPasswordForm() { const [message, action, pending] = useActionState(updatePasswordAction, undefined); return <form action={action} className="auth-form form-stack"><h2>Crie uma nova senha.</h2>{message && <p className="form-error" role="alert">{message}</p>}<label>Nova senha<input className="input" name="password" type="password" minLength={8} required /></label><label>Confirmar senha<input className="input" name="confirmation" type="password" minLength={8} required /></label><PasswordChecklist confirmName="confirmation" /><button type="submit" className="button button-accent button-block" disabled={pending}>Alterar senha</button></form>; }

export function ChangePasswordForm({ hasPassword = true }: { hasPassword?: boolean }) { const [message, action, pending] = useActionState(changePasswordAction, undefined); return <section className="panel form-stack"><span className="eyebrow">Senha</span><h2>{hasPassword ? "Trocar senha" : "Criar senha"}</h2><p className="muted">{hasPassword ? "Use pelo menos 8 caracteres, uma letra maiúscula e um número. Outros aparelhos conectados serão desconectados." : "Sua conta usa o login do Google. Crie uma senha para também entrar com e-mail e senha."}</p><form action={action} className="form-stack">{hasPassword && <label>Senha atual<input className="input" name="currentPassword" type="password" autoComplete="current-password" required /></label>}<label>Nova senha<input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirmar senha<input className="input" name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label><PasswordChecklist confirmName="confirmation" />{message && <p className={message.startsWith("Senha alterada") ? "form-feedback" : "form-error"} role={message.startsWith("Senha alterada") ? "status" : "alert"}>{message}</p>}<button type="submit" className="button button-dark" disabled={pending}>{pending ? "Salvando…" : hasPassword ? "Trocar senha" : "Criar senha"}</button></form></section>; }
