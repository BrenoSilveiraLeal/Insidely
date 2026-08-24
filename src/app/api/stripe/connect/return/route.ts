import { getStripe } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  // The migration adds provider-specific columns beyond the generated legacy type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id, stripeAccountId").eq("userId", user.id).maybeSingle();
  if (profile?.stripeAccountId) {
    const account = await getStripe().accounts.retrieve(profile.stripeAccountId);
    await supabase.from("ProfessionalProfile").update({ stripeOnboardingStatus: account.details_submitted ? "COMPLETE" : "PENDING", stripeChargesEnabled: account.charges_enabled, stripePayoutsEnabled: account.payouts_enabled, updatedAt: new Date().toISOString() }).eq("id", profile.id);
  }
  return Response.redirect(new URL("/consultor/perfil?stripe=return", request.url));
}
