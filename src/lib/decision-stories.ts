import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { HOME_STORY_LIMIT } from "@/lib/story-limits";

// Daily: 14 days after a finished conversation, invite the customer to tell what they decided.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function promptDecisionStories(supabase: any, now = new Date()) {
  const { data: bookings } = await supabase.from("Booking").select("id, customerId, professionalProfile:ProfessionalProfile(userId)")
    .in("status", ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"]).is("decisionPromptSentAt", null)
    .lte("startsAt", new Date(now.getTime() - 14 * 86_400_000).toISOString()).gte("startsAt", new Date(now.getTime() - 30 * 86_400_000).toISOString()).limit(100);
  let prompted = 0;
  for (const booking of (bookings ?? []) as { id: string; customerId: string; professionalProfile: { userId: string } | { userId: string }[] | null }[]) {
    const consultant = Array.isArray(booking.professionalProfile) ? booking.professionalProfile[0] : booking.professionalProfile;
    const { data: claimed } = await supabase.from("Booking").update({ decisionPromptSentAt: now.toISOString() }).eq("id", booking.id).is("decisionPromptSentAt", null).select("id").maybeSingle();
    if (!claimed || consultant?.userId === booking.customerId) continue;
    await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: booking.customerId, title: "E aí, o que você decidiu?", body: "Faz duas semanas da sua conversa. Conte o que você decidiu — leva um minuto.", href: `/dashboard/decidi/${booking.id}`, createdAt: now.toISOString() });
    prompted++;
  }
  return prompted;
}

// Stories the team featured on the home page carousel (text only, never the customer's name).
// Until the featuredAt column exists (migration 20261101098000), the latest approved ones are used.
export async function getPublishedStories(limit = HOME_STORY_LIMIT) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const featured = await supabase.from("DecisionStory").select("bookingId, story").eq("allowPublish", true).eq("status", "APPROVED").not("featuredAt", "is", null).order("featuredAt").limit(limit);
  if (!featured.error) return (featured.data ?? []) as { bookingId: string; story: string }[];
  const { data } = await supabase.from("DecisionStory").select("bookingId, story").eq("allowPublish", true).eq("status", "APPROVED").order("createdAt", { ascending: false }).limit(limit);
  return (data ?? []) as { bookingId: string; story: string }[];
}

// Approved stories from conversations with one consultant, shown on that consultant's profile.
export async function getProfileStories(profileId: string, limit = 6) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createSupabaseServiceClient() as any).from("DecisionStory").select("bookingId, story, createdAt, booking:Booking!inner(professionalProfileId)").eq("allowPublish", true).eq("status", "APPROVED").eq("booking.professionalProfileId", profileId).order("createdAt", { ascending: false }).limit(limit);
  return ((data ?? []) as { bookingId: string; story: string; createdAt: string }[]).map(({ bookingId, story, createdAt }) => ({ bookingId, story, createdAt }));
}
