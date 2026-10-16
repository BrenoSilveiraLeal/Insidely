import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ContinuePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") redirect(next ? `/mfa?next=${encodeURIComponent(next)}` : "/mfa");
  const user = await requireUser(undefined, { allowIncomplete: true });
  if (!user.onboardingCompleted) redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) redirect(next);
  redirect(user.role === "CONSULTANT" ? "/consultor" : user.role === "ADMIN" ? "/admin" : "/dashboard");
}
