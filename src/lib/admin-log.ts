import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Every admin decision is recorded (who, what, on whom, when) and listed in /admin/registro.
export async function logAdminAction(adminUserId: string, action: string, targetUserId?: string | null, detail?: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (createSupabaseServiceClient() as any).from("AdminActionLog").insert({ adminUserId, action, targetUserId: targetUserId ?? null, detail: detail?.slice(0, 500) ?? null });
  if (error) console.error("admin_log_failed", { action, error });
}

// Scheduled jobs record each run, for the status page and the failure alert.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordCronRun(supabase: any, job: string, ok: boolean, detail: unknown) {
  await supabase.from("CronRun").insert({ job, ok, detail: JSON.stringify(detail).slice(0, 1000) }).then(() => undefined, () => undefined);
}
