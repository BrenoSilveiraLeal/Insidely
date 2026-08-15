import Link from "next/link";
import { LoginForm } from "@/components/auth-form";

const socialMessages: Record<string, string> = {
	pendente: "O login social ainda precisa de configuração.",
	erro: "Não foi possível completar o login social.",
	config: "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para usar Google.",
	callback: "O callback do Google/Supabase falhou. Verifique as Redirect URLs no Supabase Auth.",
	db: "O login social chegou ao callback, mas o banco de dados está indisponível (Prisma P1001).",
};

export default async function LoginPage({searchParams}:{searchParams:Promise<{social?:string}>}){
	const params=await searchParams;
	const socialMessage = params.social ? socialMessages[params.social] ?? socialMessages.erro : undefined;
	return <main className="auth-page"><section className="auth-art"><Link className="brand" href="/">insidely.</Link><h1>Entre com perguntas.</h1></section><section className="auth-panel">{socialMessage && <p className="form-error" role="alert">{socialMessage}</p>}<LoginForm google linkedin socialPending={params.social==="pendente"}/></section></main>
}
