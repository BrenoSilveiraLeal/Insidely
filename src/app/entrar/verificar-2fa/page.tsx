import { redirect } from "next/navigation";
import { PublicShell } from "@/components/public-shell";
import { TwoFactorChallenge } from "@/components/two-factor-challenge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function VerifyTwoFactorPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  return <PublicShell><main className="auth-page"><section className="auth-panel"><TwoFactorChallenge/></section></main></PublicShell>;
}
