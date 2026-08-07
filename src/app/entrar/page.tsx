import Link from "next/link";
import { LoginForm } from "@/components/auth-form";
export default function LoginPage(){return <main className="auth-page"><section className="auth-art"><Link className="brand" href="/">insidely.</Link><h1>Entre com perguntas.</h1></section><section className="auth-panel"><LoginForm/></section></main>}

