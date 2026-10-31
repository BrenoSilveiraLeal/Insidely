import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Sign-up and "become a consultant" ask whether the person still works at the company, since when
// (and until when, if they left) and what they do or did there. The RPCs that create the profile
// still take "yearsExperience"; it is derived here from the period, and the experience row is then
// completed with the period and summary.
export type EmploymentPeriod = { isCurrent: boolean; startedAt: string; endedAt: string | null; summary: string; years: number };

const month = (value: FormDataEntryValue | null) => /^\d{4}-\d{2}$/.test(String(value ?? "")) ? String(value) : null;

export function readEmploymentPeriod(formData: FormData): EmploymentPeriod | string {
  const isCurrent = formData.get("employmentStatus") !== "former";
  const start = month(formData.get("startedAt"));
  const end = isCurrent ? null : month(formData.get("endedAt"));
  const summary = String(formData.get("experienceSummary") || "").trim().replace(/\s+/g, " ");
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (!start) return "Informe o mês e o ano em que você entrou na empresa.";
  if (start > thisMonth) return "A data de entrada não pode estar no futuro.";
  if (!isCurrent && !end) return "Informe o mês e o ano em que você saiu da empresa.";
  if (end && end < start) return "A data de saída precisa ser depois da data de entrada.";
  if (end && end > thisMonth) return "A data de saída não pode estar no futuro.";
  if (summary.length < 15 || summary.length > 300) return "Conte em 15 a 300 caracteres o que você faz ou fazia na empresa.";
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = (end ?? thisMonth).split("-").map(Number);
  const years = Math.max(0, Math.min(60, Math.floor(((ey - sy) * 12 + (em - sm)) / 12)));
  formData.set("yearsExperience", String(years));
  return { isCurrent, startedAt: `${start}-01T12:00:00Z`, endedAt: end ? `${end}-01T12:00:00Z` : null, summary, years };
}

// Completes the experience the RPC just created (the profile's most recent one).
export async function saveEmploymentPeriod(userId: string, period: EmploymentPeriod) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", userId).maybeSingle();
  if (!profile) return;
  const { data: experience } = await supabase.from("EmploymentExperience").select("id").eq("professionalProfileId", profile.id).order("createdAt", { ascending: false }).limit(1).maybeSingle();
  if (!experience) return;
  await supabase.from("EmploymentExperience").update({ isCurrent: period.isCurrent, startedAt: period.startedAt, endedAt: period.endedAt, summary: period.summary }).eq("id", experience.id);
}
