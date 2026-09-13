"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { changePasswordAction, loginAction, registerAction, requestPasswordResetAction, updatePasswordAction } from "@/app/actions";

function PasswordField({ name, label, autoComplete }: { name: string; label: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return <label>{label}<span className="password-field"><input className="input" name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={8} required /><button type="button" className="password-toggle" onClick={() => setVisible((value) => !value)}>{visible ? "Ocultar" : "Mostrar"}</button></span></label>;
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.27-2.09 3.57-5.17 3.57-8.64Z" /><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3A7.16 7.16 0 0 1 12 19.22a7.2 7.2 0 0 1-6.77-4.98H1.23v3.1A12 12 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.23 14.24a7.2 7.2 0 0 1 0-4.48v-3.1H1.23a12 12 0 0 0 0 10.68l4-3.1Z" /><path fill="#EA4335" d="M12 4.78a6.52 6.52 0 0 1 4.6 1.8l3.45-3.45A11.99 11.99 0 0 0 1.23 6.66l4 3.1A7.2 7.2 0 0 1 12 4.78Z" /></svg>;
}

function SocialButtons({ google }: { google: boolean }) {
  if (!google) return null;
  return <div className="social-grid"><Link className="button social-button" href="/auth/google?next=/continuar"><GoogleMark /><span>Google</span></Link></div>;
}

export function LoginForm({ google, socialPending = false }: { google: boolean; socialPending?: boolean }) {
  const [error, action, pending] = useActionState(loginAction, undefined);
  return <form action={action} className="auth-form form-stack"><span className="eyebrow">Acesso seguro</span><h2>Entre na sua conta.</h2>{(error || socialPending) && <p className="form-error" role="alert">{error || "Não foi possível concluir o login social."}</p>}<label>E-mail<input className="input" name="email" type="email" required /></label><PasswordField name="password" label="Senha" autoComplete="current-password" /><button className="button button-accent button-block" disabled={pending}>{pending ? "Entrando..." : "Entrar"}</button><Link href="/recuperar-senha"><u>Esqueci minha senha</u></Link><SocialButtons google={google} /><p>Não tem uma conta? <Link href="/cadastro"><u>Cadastre-se</u></Link></p></form>;
}

export function RegisterForm({ google }: { google: boolean }) {
  const [error, action, pending] = useActionState(registerAction, undefined);
  return <form action={action} className="auth-form form-stack"><h2>Crie sua conta.</h2>{error && <p className="form-error" role="alert">{error}</p>}<label>Nome<input className="input" name="name" required /></label><label>E-mail<input className="input" name="email" type="email" required /></label><PasswordField name="password" label="Senha" autoComplete="new-password" /><PasswordField name="confirmPassword" label="Confirmar senha" autoComplete="new-password" /><select className="select" name="role"><option value="USER">Conversar com profissionais</option><option value="CONSULTANT">Compartilhar minha experiência</option></select><label className="check-row"><input name="terms" type="checkbox" required /><span>Li e concordo com os termos.</span></label><button className="button button-accent button-block" disabled={pending}>{pending ? "Criando..." : "Criar conta"}</button><SocialButtons google={google} /></form>;
}

export function PasswordRecoveryForm() { const [message, action, pending] = useActionState(requestPasswordResetAction, undefined); return <form action={action} className="auth-form form-stack"><h2>Esqueceu sua senha?</h2>{message && <p className="form-feedback" role="status">{message}</p>}<label>E-mail<input className="input" name="email" type="email" required /></label><button className="button button-accent button-block" disabled={pending}>{pending ? "Enviando…" : "Enviar link"}</button><Link href="/entrar">Voltar para entrar</Link></form>; }

export function NewPasswordForm() { const [message, action, pending] = useActionState(updatePasswordAction, undefined); return <form action={action} className="auth-form form-stack"><h2>Crie uma nova senha.</h2>{message && <p className="form-error" role="alert">{message}</p>}<label>Nova senha<input className="input" name="password" type="password" minLength={8} required /></label><label>Confirmar senha<input className="input" name="confirmation" type="password" minLength={8} required /></label><button className="button button-accent button-block" disabled={pending}>Alterar senha</button></form>; }

export function ChangePasswordForm() { const [message, action, pending] = useActionState(changePasswordAction, undefined); return <section className="panel form-stack"><span className="eyebrow">Senha</span><h2>Trocar senha</h2><p className="muted">Use pelo menos 8 caracteres, uma letra maiúscula e um número.</p><form action={action} className="form-stack"><label>Nova senha<input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required /></label><label>Confirmar senha<input className="input" name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>{message && <p className={message.startsWith("Senha alterada") ? "form-feedback" : "form-error"} role={message.startsWith("Senha alterada") ? "status" : "alert"}>{message}</p>}<button className="button button-dark" disabled={pending}>{pending ? "Salvando…" : "Trocar senha"}</button></form></section>; }
