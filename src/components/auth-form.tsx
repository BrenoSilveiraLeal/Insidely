"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, undefined);
  return <form action={action} className="auth-form form-stack"><span className="eyebrow">Acesso seguro</span><h2>Entre na sua conta.</h2>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" autoComplete="email" required/></div>
    <div className="field"><label htmlFor="password">Senha</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required/></div>
    <button className="button button-accent button-block" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button><p>Não tem conta? <Link href="/cadastro"><u>Cadastre-se</u></Link></p>
    <div className="demo-box"><strong>Acessos demonstrativos</strong><br/>Usuário: demo@insidely.com<br/>Consultor: consultor@insidely.com<br/>Admin: admin@insidely.com<br/>Senha: Demo@123</div>
  </form>;
}

export function RegisterForm() {
  const [error, action, pending] = useActionState(registerAction, undefined);
  return <form action={action} className="auth-form form-stack"><span className="eyebrow">Comece por aqui</span><h2>Crie sua conta.</h2>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="field"><label htmlFor="name">Nome</label><input className="input" id="name" name="name" autoComplete="name" required/></div>
    <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" autoComplete="email" required/></div>
    <div className="field"><label htmlFor="password">Senha</label><input className="input" id="password" name="password" type="password" minLength={8} required/></div>
    <div className="field"><label htmlFor="role">Quero</label><select className="select" id="role" name="role"><option value="USER">Conversar com profissionais</option><option value="CONSULTANT">Compartilhar minha experiência</option></select></div>
    <button className="button button-accent button-block" disabled={pending}>{pending ? "Criando…" : "Criar conta"}</button><p>Já tem conta? <Link href="/entrar"><u>Entrar</u></Link></p>
  </form>;
}

