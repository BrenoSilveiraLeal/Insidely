import "server-only";
import { consumeQuota } from "@/lib/auth-email-throttle";
import { sendTransactionalEmail } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Warns every admin (bell + e-mail) when something operational breaks: a scheduled job failing or
// Google Meet no longer creating rooms. The same problem alerts at most once every 6 hours.
export async function alertAdmins(key: string, title: string, body: string) {
  try {
    if (!await consumeQuota(`ops-alert:${key}`, 1, 6 * 3600)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseServiceClient() as any;
    const { data: admins } = await supabase.from("User").select("id, email, name").eq("role", "ADMIN");
    const now = new Date().toISOString();
    for (const admin of (admins ?? []) as { id: string; email: string; name: string }[]) {
      await supabase.from("Notification").insert({ id: crypto.randomUUID(), userId: admin.id, title, body, href: "/admin/status", createdAt: now });
      if (admin.email) await sendTransactionalEmail({ to: admin.email, subject: `[Insidely] ${title}`, html: `<p>${title}</p><p>${body}</p><p><a href="${getAppUrl()}/admin/status">Abrir a página de status</a></p>` }).catch(() => undefined);
    }
  } catch (error) {
    console.error("ops_alert_failed", { key, error });
  }
}
