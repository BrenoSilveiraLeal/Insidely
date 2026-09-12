import Link from "next/link";
import { LoginForm } from "@/components/auth-form";
import { RememberLogin } from "@/components/remember-login";

const socialMessages: Record<string, string> = {
	pendente: "O login social ainda precisa de configura.",
	erro: "Não foi possível completar o login social.",
	config: "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para usar Google.",
	callback: "O callback do Google/Supabase falhou. Verifique as Redirect URLs no Supabase Auth.",
	profile: "Sua conta Google foi autenticada, mas n foi poss sincronizar seu perfil no Supabase. Tente novamente.",
	error: "Não foi possível concluir o login Google pelo Supabase. Tente novamente.",
};
const accountMessages: Record<string, string> = {
	confirmar: "Conta criada. Confira seu e-mail e confirme o cadastro antes de entrar.",
	alterada: "Senha alterada com sucesso. Entre novamente com sua nova senha.",
};

export default async function LoginPage({searchParams}:{searchParams:Promise<{social?:string;cadastro?:string;senha?:string}>}){
	const params=await searchParams;
	const socialMessage = params.social ? socialMessages[params.social] ?? socialMessages.erro : undefined;
	const accountMessage = params.cadastro ? accountMessages[params.cadastro] : params.senha ? accountMessages[params.senha] : undefined;
	return <main className="auth-page"><section className="auth-art"><Link className="brand" href="/">insidely.</Link><h1>Entre com perguntas.</h1></section><section className="auth-panel">{socialMessage && <p className="form-error" role="alert">{socialMessage}</p>}{accountMessage && <p className="form-feedback" role="status">{accountMessage}</p>}<LoginForm google socialPending={params.social==="pendente"}/><RememberLogin /></section></main>
}
