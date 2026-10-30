import "server-only";
import { cache } from "react";
import { parseDbDate } from "@/lib/format";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Consultant profiles show a "Novo" badge during their first two weeks on the platform.
export const NEW_PROFILE_DAYS = 14;

// One small query per request: only profiles created in the last two weeks can be new (the public
// views do not expose createdAt).
const getProfileCreatedDates = cache(async () => {
  const since = new Date(Date.now() - NEW_PROFILE_DAYS * 24 * 60 * 60_000).toISOString();
  const { data, error } = await createSupabaseServiceClient().from("ProfessionalProfile").select("id, createdAt").eq("isActive", true).gte("createdAt", since);
  if (error) { console.error("profile_age_lookup_failed", { error }); return new Map<string, Date>(); }
  return new Map((data ?? []).map((row) => [row.id, parseDbDate(row.createdAt)]));
});

export async function isNewProfile(profileId: string, now = Date.now()) {
  const createdAt = (await getProfileCreatedDates()).get(profileId);
  return Boolean(createdAt) && now - createdAt!.getTime() < NEW_PROFILE_DAYS * 24 * 60 * 60_000;
}
