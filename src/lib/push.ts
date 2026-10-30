import "server-only";
import webpush from "web-push";

// Sends the in-app notifications of the last minutes to every device of the person that allowed
// push. Run by the 5-minute job; each notification is pushed once ("pushSentAt").
export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendPendingPushes(supabase: any, now = new Date()) {
  if (!pushConfigured()) return 0;
  webpush.setVapidDetails("mailto:insidelybrasil@gmail.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const { data: subscriptions } = await supabase.from("PushSubscription").select("endpoint, userId, p256dh, auth");
  if (!subscriptions?.length) return 0;
  const userIds = [...new Set((subscriptions as { userId: string }[]).map((row) => row.userId))];
  const { data: notifications } = await supabase.from("Notification").select("id, userId, title, body, href").in("userId", userIds).is("pushSentAt", null).gte("createdAt", new Date(now.getTime() - 15 * 60_000).toISOString()).limit(200);
  let sent = 0;
  for (const notification of (notifications ?? []) as { id: string; userId: string; title: string; body: string; href: string | null }[]) {
    const { data: claimed } = await supabase.from("Notification").update({ pushSentAt: now.toISOString() }).eq("id", notification.id).is("pushSentAt", null).select("id").maybeSingle();
    if (!claimed) continue;
    for (const subscription of (subscriptions as { endpoint: string; userId: string; p256dh: string; auth: string }[]).filter((row) => row.userId === notification.userId)) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: notification.title, body: notification.body, href: notification.href }), { TTL: 3600 });
        sent++;
      } catch (error) {
        // 404/410: the device revoked the permission or the app was uninstalled.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await supabase.from("PushSubscription").delete().eq("endpoint", subscription.endpoint);
        else console.error("push_send_failed", { status });
      }
    }
  }
  return sent;
}
