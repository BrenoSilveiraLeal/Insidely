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
