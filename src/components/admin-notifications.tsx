import { NotificationPopover } from "@/components/notification-popover";
import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Bell for the admin panel (new proofs to review, catalog requests, reports, no-shows) and for
// support staff (new support requests and reports).
export async function AdminNotifications() {
  const user = await getAuthenticatedUser();
  if (user?.role !== "ADMIN" && user?.role !== "SUPPORT") return null;
  const { data } = await createSupabaseServiceClient().from("Notification").select("id, title, body, href, readAt").eq("userId", user.id).order("createdAt", { ascending: false }).limit(30);
  return <NotificationPopover notifications={(data ?? []).map((item) => ({ ...item, readAt: item.readAt ?? null }))}/>;
}
