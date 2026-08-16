import Link from "next/link"; import { PasswordRecoveryForm } from "@/components/auth-form";
export default function Page(){return <main className="auth-page"><section className="auth-art"><Link className="brand" href="/">insidely.</Link><h1>Volte a ter acesso.</h1></section><section className="auth-panel"><PasswordRecoveryForm/></section></main>}
