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
    const account = await getStripe().v2.core.accounts.retrieve(profile.stripeAccountId, { include: ["configuration.recipient"] });
    const transfersStatus = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
    await supabase.from("ProfessionalProfile").update({ stripeOnboardingStatus: transfersStatus === "active" ? "COMPLETE" : "PENDING", stripeChargesEnabled: false, stripePayoutsEnabled: transfersStatus === "active", updatedAt: new Date().toISOString() }).eq("id", profile.id);
  }
  return Response.redirect(new URL("/consultor/perfil?stripe=return", request.url));
}
