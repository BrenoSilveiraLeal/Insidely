import "server-only";
import { consumeQuota } from "@/lib/auth-email-throttle";

// Daily scan for accounts that deserve a look, sent to the admins' bell (at most once a week per
// account): several reports, repeated blocked chat messages, being blocked by several people or a
// poor rating as a customer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function flagSuspiciousAccounts(supabase: any, now = new Date()) {
  const month = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString();
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  const [{ data: reports }, { data: moderation }, { data: blocks }, { data: feedback }] = await Promise.all([
    supabase.from("Report").select("targetUserId").gte("createdAt", month).not("targetUserId", "is", null),
    supabase.from("ChatModerationEvent").select("userId").gte("createdAt", week),
    supabase.from("UserBlock").select("blockedId").gte("createdAt", month),
    supabase.from("CustomerFeedback").select("customerId, rating"),
  ]);
  const reasons = new Map<string, string[]>();
  const add = (userId: string, reason: string) => reasons.set(userId, [...(reasons.get(userId) ?? []), reason]);
  const count = (rows: Record<string, string>[] | null, key: string) => (rows ?? []).reduce((map, row) => map.set(row[key], (map.get(row[key]) ?? 0) + 1), new Map<string, number>());
  for (const [userId, total] of count(reports, "targetUserId")) if (total >= 3) add(userId, `${total} denúncias em 30 dias`);
  for (const [userId, total] of count(moderation, "userId")) if (total >= 5) add(userId, `${total} mensagens bloqueadas em 7 dias`);
  for (const [userId, total] of count(blocks, "blockedId")) if (total >= 3) add(userId, `bloqueado por ${total} pessoas em 30 dias`);
  const ratings = new Map<string, number[]>();
  for (const row of (feedback ?? []) as { customerId: string; rating: number }[]) ratings.set(row.customerId, [...(ratings.get(row.customerId) ?? []), row.rating]);
  for (const [userId, list] of ratings) { const average = list.reduce((a, b) => a + b, 0) / list.length; if (list.length >= 3 && average < 2.5) add(userId, `nota ${average.toFixed(1)} como cliente`); }
  if (!reasons.size) return 0;
  const { data: admins } = await supabase.from("User").select("id").eq("role", "ADMIN");
  const { data: users } = await supabase.from("User").select("id, name").in("id", [...reasons.keys()]);
  let flagged = 0;
  for (const [userId, list] of reasons) {
    if (!await consumeQuota(`suspicious:${userId}`, 1, 7 * 24 * 3600)) continue;
    const name = (users ?? []).find((user: { id: string }) => user.id === userId)?.name ?? "Conta";
    const rows = (admins ?? []).map((admin: { id: string }) => ({ id: crypto.randomUUID(), userId: admin.id, title: `Conta para revisar: ${name}`, body: list.join(" · "), href: `/admin/usuarios/${userId}`, createdAt: now.toISOString() }));
    if (rows.length) await supabase.from("Notification").insert(rows);
    flagged++;
  }
  return flagged;
}
