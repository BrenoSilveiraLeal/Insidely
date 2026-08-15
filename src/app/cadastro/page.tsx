import Link from "next/link";
import { RegisterForm } from "@/components/auth-form";
export default function RegisterPage(){return <main className="auth-page"><section className="auth-art" style={{background:"var(--blue)"}}><Link className="brand" href="/">insidely.</Link><h1>Decida com realidade.</h1></section><section className="auth-panel"><RegisterForm google linkedin/></section></main>}
