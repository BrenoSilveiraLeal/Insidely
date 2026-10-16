import { OnboardingForm } from "@/components/onboarding-form";
import { getPublicCompanies, getPublicProfessions } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const metadata = { title: "Complete seu cadastro" };
export default async function OnboardingPage({searchParams}:{searchParams:Promise<{next?:string}>}){const {next}=await searchParams;const user=await requireUser(undefined,{allowIncomplete:true});const supabase=await createSupabaseServerClient();const [companies,professions,{data:{user:authUser}}]=await Promise.all([getPublicCompanies(),getPublicProfessions(),supabase.auth.getUser()]);
// Pre-select the role picked on the sign-up form; onboarding still lets the person change it.
const initialRole=user.role==="CONSULTANT"||authUser?.user_metadata?.role==="CONSULTANT"?"CONSULTANT":"USER";return <main className="auth-page"><section className="auth-art" style={{background:"var(--amber)"}}><h1>Seu contexto começa aqui.</h1></section><section className="auth-panel onboarding-panel"><OnboardingForm firstName={user.name?.split(" ")[0]||"Pessoa"} initialRole={initialRole} companies={companies} professions={professions} next={next}/></section></main>}
