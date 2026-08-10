import Link from "next/link";
import { RegisterForm } from "@/components/auth-form";
export default function RegisterPage(){const google=Boolean(process.env.AUTH_GOOGLE_ID&&process.env.AUTH_GOOGLE_SECRET);const linkedin=Boolean(process.env.AUTH_LINKEDIN_ID&&process.env.AUTH_LINKEDIN_SECRET);return <main className="auth-page"><section className="auth-art" style={{background:"var(--blue)"}}><Link className="brand" href="/">insidely.</Link><h1>Decida com realidade.</h1></section><section className="auth-panel"><RegisterForm google={google} linkedin={linkedin}/></section></main>}
