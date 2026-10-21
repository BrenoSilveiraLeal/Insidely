import Link from "next/link";
import { LoginForm } from "@/components/auth-form";

export const metadata = { title: "Entrar", description: "Acesse sua conta na Insidely." };
const socialMessages: Record<string, string> = {
	pendente: "O login social ainda precisa de configuração.",
	erro: "Não foi possível completar o login social.",
	config: "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para usar Google.",
	callback: "O callback do Google/Supabase falhou. Verifique as Redirect URLs no Supabase Auth.",
	profile: "Sua conta Google foi autenticada, mas não foi possível sincronizar seu perfil. Tente novamente.",
	error: "Não foi possível concluir o login Google pelo Supabase. Tente novamente.",
	conta_existente: "Já existe outra conta Insidely com este e-mail. Entre com e-mail e senha ou fale com o suporte para unificar as contas.",
	vinculacao: "Encontramos um cadastro antigo com este e-mail. Entre com e-mail e senha ou recupere sua senha para acessá-lo.",
	desativado: "Este método de login não está disponível. Use e-mail e senha ou o Google.",
};
const accountMessages: Record<string, string> = {
	confirmar: "Enviamos um e-mail para você. Abra o link para continuar. Não chegou em alguns minutos? Confira a caixa de spam.",
	alterada: "Senha alterada com sucesso. Entre novamente com sua nova senha.",
	link_invalido: "Este link expirou ou já foi usado. Entre na sua conta ou peça um novo link.",
};

export default async function LoginPage({searchParams}:{searchParams:Promise<{social?:string;cadastro?:string;senha?:string;next?:string;erro?:string}>}){
	const params=await searchParams;
	const sessionMessage = params.erro === "sessao_expirada" ? "Sua sessão expirou. Entre novamente para continuar." : undefined;
	const socialMessage = params.social ? socialMessages[params.social] ?? socialMessages.erro : undefined;
	const accountMessage = params.cadastro ? accountMessages[params.cadastro] : params.senha ? accountMessages[params.senha] : undefined;
	return <main className="auth-page"><section className="auth-art"><Link className="brand" href="/">insidely.</Link><h1>Entre com perguntas.</h1></section><section className="auth-panel">{(socialMessage || sessionMessage) && <p className="form-error" role="alert">{socialMessage || sessionMessage}</p>}{accountMessage && <p className="form-feedback" role="status">{accountMessage}</p>}<LoginForm google socialPending={params.social==="pendente"} next={params.next}/></section></main>
}
