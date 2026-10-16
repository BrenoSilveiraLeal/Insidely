import { redirect } from "next/navigation";
import { MfaSettings } from "@/components/mfa-settings";
import { PublicShell } from "@/components/public-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export const metadata = { title: "Verificação em duas etapas" };
export default async function MfaPage({searchParams}:{searchParams:Promise<{next?:string}>}){const {next}=await searchParams;const continueTo=next&&next.startsWith("/")&&!next.startsWith("//")?`/continuar?next=${encodeURIComponent(next)}`:"/continuar";const s=await createSupabaseServerClient();const{data:{user}}=await s.auth.getUser();if(!user)redirect("/entrar");const{data}=await s.auth.mfa.getAuthenticatorAssuranceLevel();if(!data||data.currentLevel==="aal2"||data.nextLevel!=="aal2")redirect(continueTo);return <PublicShell><section className="section"><div className="container" style={{maxWidth:560}}><MfaSettings challenge continueTo={continueTo}/></div></section></PublicShell>}
