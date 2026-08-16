import Link from "next/link"; import { NewPasswordForm } from "@/components/auth-form";
export default function Page(){return <main className="auth-page"><section className="auth-art"><Link className="brand" href="/">insidely.</Link><h1>Um novo começo.</h1></section><section className="auth-panel"><NewPasswordForm/></section></main>}
