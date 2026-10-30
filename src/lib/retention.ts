import "server-only";

// Data retention, run by the daily job:
// - access records (Marco Civil da Internet, art. 15) are kept for 6 months;
// - the identity (CPF, birth date) of an account deleted more than 5 years ago, the general time
//   limit for consumer claims (CDC, art. 27), is erased together with its chat moderation records.
export const ACCESS_LOG_MONTHS = 6;
export const DELETED_ACCOUNT_YEARS = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyRetention(supabase: any, now = new Date()) {
  const accessCutoff = new Date(now); accessCutoff.setMonth(accessCutoff.getMonth() - ACCESS_LOG_MONTHS);
  const { count: accessLogs } = await supabase.from("AccessLog").delete({ count: "exact" }).lt("createdAt", accessCutoff.toISOString());
  const accountCutoff = new Date(now); accountCutoff.setFullYear(accountCutoff.getFullYear() - DELETED_ACCOUNT_YEARS);
  const { data: expired } = await supabase.from("User").select("id").is("auth_user_id", null).like("email", "deleted+%@invalid.insidely").lt("updatedAt", accountCutoff.toISOString()).limit(500);
  const ids = (expired ?? []).map((row: { id: string }) => row.id);
  if (ids.length) {
    await supabase.from("CustomerIdentity").delete().in("userId", ids);
    await supabase.from("ChatModerationEvent").delete().in("userId", ids);
  }
  return { accessLogs: accessLogs ?? 0, identities: ids.length };
}
