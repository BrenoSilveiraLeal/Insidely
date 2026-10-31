import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type ThreadMessage = { id: string; fromStaff: boolean; body: string; createdAt: string; authorName: string | null };
export type SupportCase = { id: string; reporterId: string | null; targetUserId: string | null; bookingId: string | null; category: string; description: string; status: string; createdAt: string; updatedAt: string };

export const OPEN_REPORT_STATUSES = ["OPEN", "IN_REVIEW"];

// Status as the person who opened the case reads it: OPEN waits for the team, IN_REVIEW for them.
export function personCaseStatus(status: string) {
  return status === "OPEN" ? "Aguardando o suporte" : status === "IN_REVIEW" ? "Respondido pelo suporte" : status === "RESOLVED" ? "Resolvido" : "Encerrado";
}

export async function getSupportCase(reportId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const [{ data: report }, { data: rows }] = await Promise.all([
    supabase.from("Report").select("id, reporterId, targetUserId, bookingId, category, description, status, createdAt, updatedAt").eq("id", reportId).maybeSingle(),
    supabase.from("ReportMessage").select("id, fromStaff, body, createdAt, author:User(name)").eq("reportId", reportId).order("createdAt"),
  ]);
  if (!report) return null;
  const messages: ThreadMessage[] = ((rows ?? []) as { id: string; fromStaff: boolean; body: string; createdAt: string; author: { name: string } | { name: string }[] | null }[])
    .map((row) => ({ id: row.id, fromStaff: row.fromStaff, body: row.body, createdAt: row.createdAt, authorName: (Array.isArray(row.author) ? row.author[0]?.name : row.author?.name) ?? null }));
  return { report: report as SupportCase, messages };
}

// Cases the person opened (support requests and reports), newest activity first.
export async function getMySupportCases(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createSupabaseServiceClient() as any).from("Report").select("id, category, description, status, bookingId, targetUserId, createdAt, updatedAt").eq("reporterId", userId).order("updatedAt", { ascending: false }).limit(50);
  return (data ?? []) as SupportCase[];
}

// Who took each report case (CaseAssignment "report:<id>"), for the support and reports lists.
export async function getReportCaseOwners(reportIds: string[], adminId: string) {
  const owners = new Map<string, { name: string; mine: boolean }>();
  if (!reportIds.length) return owners;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createSupabaseServiceClient() as any).from("CaseAssignment").select("caseKey, adminUserId, admin:User(name)").in("caseKey", reportIds.map((id) => `report:${id}`));
  for (const row of (data ?? []) as { caseKey: string; adminUserId: string; admin: { name: string } | { name: string }[] | null }[]) {
    owners.set(row.caseKey.slice("report:".length), { name: (Array.isArray(row.admin) ? row.admin[0]?.name : row.admin?.name) ?? "Admin", mine: row.adminUserId === adminId });
  }
  return owners;
}

// Rating of the service, given by the person after the case closed (table SupportRating).
export const SUPPORT_RATINGS = [{ value: "RUIM", label: "Ruim", score: 1 }, { value: "BOM", label: "Bom", score: 2 }, { value: "OTIMO", label: "Ótimo", score: 3 }] as const;
export type SupportRating = { id: string; reportId: string; rating: string; comment: string | null; createdAt: string };
export const supportRatingLabel = (value: string) => SUPPORT_RATINGS.find((item) => item.value === value)?.label ?? value;

// undefined when ratings cannot be read (table not created yet): the page then offers no form.
export async function getSupportRating(reportId: string): Promise<SupportRating | null | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createSupabaseServiceClient() as any).from("SupportRating").select("id, reportId, rating, comment, createdAt").eq("reportId", reportId).maybeSingle();
  return error ? undefined : data as SupportRating | null;
}

// Ratings of one staff member, newest first, with the average score (Ruim 1, Bom 2, Ótimo 3).
export async function getStaffRatings(staffUserId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (createSupabaseServiceClient() as any).from("SupportRating").select("id, reportId, rating, comment, createdAt, report:Report(category)").eq("staffUserId", staffUserId).order("createdAt", { ascending: false }).limit(200);
  const ratings = ((data ?? []) as (SupportRating & { report: { category: string } | { category: string }[] | null })[]).map((row) => ({ ...row, category: (Array.isArray(row.report) ? row.report[0]?.category : row.report?.category) ?? "Caso" }));
  const scores = ratings.map((row): number => SUPPORT_RATINGS.find((item) => item.value === row.rating)?.score ?? 0).filter(Boolean);
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const counts = Object.fromEntries(SUPPORT_RATINGS.map((item) => [item.value, ratings.filter((row) => row.rating === item.value).length])) as Record<string, number>;
  return { ratings, average, counts };
}
