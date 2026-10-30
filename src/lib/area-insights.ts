import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const SALARY_RANGES = [
  { value: "ATE_3K", label: "Até R$ 3 mil" },
  { value: "3K_6K", label: "R$ 3 a 6 mil" },
  { value: "6K_10K", label: "R$ 6 a 10 mil" },
  { value: "10K_15K", label: "R$ 10 a 15 mil" },
  { value: "15K_25K", label: "R$ 15 a 25 mil" },
  { value: "ACIMA_25K", label: "Acima de R$ 25 mil" },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

// Aggregates what active consultants of a profession told about it (salary range of the role, a
// good and a hard point). Only shown with at least 2 answers, so no single person is exposed.
export async function getAreaInsights(professionSlug: string) {
  const supabase = service();
  const { data: profession } = await supabase.from("Profession").select("id").eq("slug", professionSlug).maybeSingle();
  if (!profession) return null;
  const { data: experiences } = await supabase.from("EmploymentExperience").select("professionalProfileId").eq("professionId", profession.id);
  const ids = [...new Set((experiences ?? []).map((row: { professionalProfileId: string }) => row.professionalProfileId))];
  if (!ids.length) return null;
  const { data: profiles } = await supabase.from("ProfessionalProfile").select("salaryRange, areaPro, areaCon").in("id", ids).eq("isActive", true);
  const rows = (profiles ?? []) as { salaryRange: string | null; areaPro: string | null; areaCon: string | null }[];
  const salaries = rows.filter((row) => row.salaryRange);
  if (salaries.length + rows.filter((row) => row.areaPro || row.areaCon).length < 2) return null;
  const distribution = SALARY_RANGES.map((range) => ({ ...range, count: salaries.filter((row) => row.salaryRange === range.value).length })).filter((range) => range.count > 0);
  return {
    answers: salaries.length,
    distribution,
    pros: rows.flatMap((row) => row.areaPro ? [row.areaPro] : []).slice(0, 6),
    cons: rows.flatMap((row) => row.areaCon ? [row.areaCon] : []).slice(0, 6),
  };
}

// "Quem conversou com este consultor também conversou com": other profiles booked by the same
// customers, most frequent first.
export async function getAlsoTalkedWith(profileId: string, limit = 3) {
  const supabase = service();
  const paid = ["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"];
  const { data: here } = await supabase.from("Booking").select("customerId").eq("professionalProfileId", profileId).in("status", paid).limit(500);
  const customers = [...new Set((here ?? []).map((row: { customerId: string }) => row.customerId))];
  if (!customers.length) return [];
  const { data: elsewhere } = await supabase.from("Booking").select("professionalProfileId").in("customerId", customers).in("status", paid).neq("professionalProfileId", profileId).limit(2000);
  const counts = new Map<string, number>();
  for (const row of (elsewhere ?? []) as { professionalProfileId: string }[]) counts.set(row.professionalProfileId, (counts.get(row.professionalProfileId) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}
