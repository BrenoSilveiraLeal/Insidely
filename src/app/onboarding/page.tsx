import { OnboardingForm } from "@/components/onboarding-form";
import { getPublicCompanies, getPublicProfessions } from "@/lib/queries";
import { requireUser } from "@/lib/session";
export default async function OnboardingPage(){const user=await requireUser(undefined,{allowIncomplete:true});const [companies,professions]=await Promise.all([getPublicCompanies(),getPublicProfessions()]);return <main className="auth-page"><section className="auth-art" style={{background:"var(--amber)"}}><h1>Seu contexto começa aqui.</h1></section><section className="auth-panel onboarding-panel"><OnboardingForm firstName={user.name?.split(" ")[0]||"Pessoa"} initialRole={user.role === "CONSULTANT" ? "CONSULTANT" : "USER"} companies={companies} professions={professions}/></section></main>}
