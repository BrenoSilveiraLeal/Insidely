import Link from "next/link";
import { LoginForm } from "@/components/auth-form";
export default async function LoginPage({searchParams}:{searchParams:Promise<{social?:string}>}){const params=await searchParams;return <main className="auth-page"><section className="auth-art"><Link className="brand" href="/">insidely.</Link><h1>Entre com perguntas.</h1></section><section className="auth-panel"><LoginForm google linkedin socialPending={params.social==="pendente"}/></section></main>}
