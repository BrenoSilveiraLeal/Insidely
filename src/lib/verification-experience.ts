import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// The experience covered by the consultant's latest approved proof (Verification.experienceId,
// added by migration 20261101099000). Null for older proofs or before the migration: callers then
// treat the main experience as the verified one.
export async function getVerifiedExperienceId(profileId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createSupabaseServiceClient() as any).from("Verification").select("experienceId").eq("professionalProfileId", profileId).eq("status", "VERIFIED").order("createdAt", { ascending: false }).limit(1).maybeSingle();
  return error ? null : (data?.experienceId as string | null) ?? null;
}
