import "server-only";

// Appeals against warnings and suspensions (SanctionAppeal, migration 20261110120000). The person
// explains why it was unfair; support accepts (the warning, or the suspension, is removed from the
// account, and an active suspension is lifted) or rejects it. One appeal per warning or suspension.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Service = any;

export type Sanction = { id: string; kind: "WARNING" | "SUSPENSION"; reason: string; createdAt: string; endsAt?: string | null; automatic: boolean; appeal: Appeal | null };
export type Appeal = { id: string; status: "PENDING" | "ACCEPTED" | "REJECTED"; reason: string; staffNote: string | null; createdAt: string; decidedAt: string | null };

// The person's warnings and suspensions, newest first, each with its appeal (if any), plus appeals
// already accepted (their sanction no longer exists, but the person sees it was removed).
export async function getSanctionsForUser(supabase: Service, userId: string) {
  const [{ data: warnings }, { data: suspensions }, { data: appeals }] = await Promise.all([
    supabase.from("AccountWarning").select("id, reason, createdAt, automatic").eq("userId", userId).order("createdAt", { ascending: false }),
    supabase.from("AccountSuspension").select("id, reason, createdAt, endsAt, automatic").eq("userId", userId).order("createdAt", { ascending: false }),
    supabase.from("SanctionAppeal").select("id, kind, warningId, suspensionId, sanctionReason, sanctionAt, reason, status, staffNote, createdAt, decidedAt").eq("userId", userId).order("createdAt", { ascending: false }),
  ]);
  type Row = { id: string; kind: "WARNING" | "SUSPENSION"; warningId: string | null; suspensionId: string | null; sanctionReason: string; sanctionAt: string; reason: string; status: Appeal["status"]; staffNote: string | null; createdAt: string; decidedAt: string | null };
  const appealRows = (appeals ?? []) as Row[];
  const toAppeal = (row: Row): Appeal => ({ id: row.id, status: row.status, reason: row.reason, staffNote: row.staffNote, createdAt: row.createdAt, decidedAt: row.decidedAt });
  const active: Sanction[] = [
    ...((warnings ?? []) as { id: string; reason: string; createdAt: string; automatic?: boolean }[]).map((row) => { const appeal = appealRows.find((item) => item.warningId === row.id); return { id: row.id, kind: "WARNING" as const, reason: row.reason, createdAt: row.createdAt, automatic: Boolean(row.automatic), appeal: appeal ? toAppeal(appeal) : null }; }),
    ...((suspensions ?? []) as { id: string; reason: string; createdAt: string; endsAt: string | null; automatic?: boolean }[]).map((row) => { const appeal = appealRows.find((item) => item.suspensionId === row.id); return { id: row.id, kind: "SUSPENSION" as const, reason: row.reason, createdAt: row.createdAt, endsAt: row.endsAt, automatic: Boolean(row.automatic), appeal: appeal ? toAppeal(appeal) : null }; }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const removed = appealRows.filter((row) => row.status === "ACCEPTED").map((row) => ({ kind: row.kind, reason: row.sanctionReason, sanctionAt: row.sanctionAt, decidedAt: row.decidedAt, staffNote: row.staffNote }));
  return { active, removed };
}

export async function createAppeal(supabase: Service, { userId, kind, sanctionId, reason }: { userId: string; kind: "WARNING" | "SUSPENSION"; sanctionId: string; reason: string }) {
  const table = kind === "WARNING" ? "AccountWarning" : "AccountSuspension";
  const { data: sanction } = await supabase.from(table).select("id, reason, createdAt").eq("id", sanctionId).eq("userId", userId).maybeSingle();
  if (!sanction) return "not_found" as const;
  const { error } = await supabase.from("SanctionAppeal").insert({ userId, kind, warningId: kind === "WARNING" ? sanctionId : null, suspensionId: kind === "SUSPENSION" ? sanctionId : null, sanctionReason: sanction.reason, sanctionAt: sanction.createdAt, reason });
  if (error) return error.code === "23505" ? "duplicate" as const : "error" as const;
  // Every admin and support staff member is told (the queue is in Advertências e suspensões).
  const { data: staff } = await supabase.from("User").select("id").in("role", ["ADMIN", "SUPPORT"]);
  const createdAt = new Date().toISOString();
  const rows = ((staff ?? []) as { id: string }[]).map((person) => ({ id: crypto.randomUUID(), userId: person.id, title: kind === "WARNING" ? "Novo recurso contra advertência" : "Novo recurso contra suspensão", body: reason.slice(0, 300), href: "/admin/sancoes#recursos", createdAt }));
  if (rows.length) await supabase.from("Notification").insert(rows);
  return "ok" as const;
}

// Accepted: the warning or suspension is deleted (it no longer counts toward the next suspension),
// and a suspension still in force is lifted. Rejected: it stays. The person is told either way.
export async function decideAppeal(supabase: Service, { appealId, accept, staffUserId, note }: { appealId: string; accept: boolean; staffUserId: string; note: string }) {
  const { data: appeal } = await supabase.from("SanctionAppeal").select("id, userId, kind, warningId, suspensionId, status").eq("id", appealId).maybeSingle();
  if (!appeal || appeal.status !== "PENDING") return false;
  const now = new Date().toISOString();
  const { data: updated } = await supabase.from("SanctionAppeal").update({ status: accept ? "ACCEPTED" : "REJECTED", staffNote: note || null, decidedBy: staffUserId, decidedAt: now }).eq("id", appealId).eq("status", "PENDING").select("id").maybeSingle();
  if (!updated) return false;
  if (accept && appeal.kind === "WARNING" && appeal.warningId) await supabase.from("AccountWarning").delete().eq("id", appeal.warningId);
  if (accept && appeal.kind === "SUSPENSION" && appeal.suspensionId) {
    const { data: latest } = await supabase.from("AccountSuspension").select("id").eq("userId", appeal.userId).order("createdAt", { ascending: false }).limit(1).maybeSingle();
    await supabase.from("AccountSuspension").delete().eq("id", appeal.suspensionId);
    // The appealed suspension is the one in force: lift it now.
    if (latest?.id === appeal.suspensionId) {
      await supabase.from("User").update({ suspendedAt: null, suspendedUntil: null, suspensionReason: null, updatedAt: now }).eq("id", appeal.userId);
      await supabase.from("ProfessionalProfile").update({ isActive: true, updatedAt: now }).eq("userId", appeal.userId).is("pausedAt", null);
    }
  }
  const what = appeal.kind === "WARNING" ? "advertência" : "suspensão";
  await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: appeal.userId, title: accept ? `Recurso aceito: ${what} removida` : "Recurso não aceito",
    body: accept ? `O suporte analisou seu recurso e removeu a ${what} da sua conta.${note ? ` ${note}` : ""}` : `O suporte analisou seu recurso e manteve a ${what}.${note ? ` Motivo: ${note}` : ""}`, href: "/dashboard/advertencias", createdAt: now });
  return true;
}
