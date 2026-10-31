import "server-only";
import { getUnreadCounts } from "@/lib/conversations";
import { getAuthenticatedUser } from "@/lib/session";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type NavNotification = { id: string; title: string; body: string; href: string | null; readAt: string | null };

// Where the chat of each mode lives: unread chat messages and message notifications count there.
const CHAT_PAGE = { consultant: "/consultor/consultas", user: "/dashboard/mensagens" } as const;
const ACTIVE = ["PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "DISPUTED"];

// The same bell on every page of the panel, and a count beside each menu item with something new:
// unread notifications that point at that page, plus unread chat messages on the chat page.
export async function getNavState(mode: "user" | "consultant") {
  const user = await getAuthenticatedUser();
  if (!user) return { notifications: [] as NavNotification[], badges: {} as Record<string, number> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const ownBookings = mode === "consultant"
    ? supabase.from("ProfessionalProfile").select("id").eq("userId", user.id).maybeSingle().then(({ data }: { data: { id: string } | null }) => data ? supabase.from("Booking").select("conversation:Conversation(id)").eq("professionalProfileId", data.id).in("status", ACTIVE).limit(300) : { data: [] })
    : supabase.from("Booking").select("conversation:Conversation(id)").eq("customerId", user.id).in("status", ACTIVE).limit(300);
  const [{ data: rows }, { data: bookings }] = await Promise.all([
    supabase.from("Notification").select("id, title, body, href, readAt").eq("userId", user.id).order("createdAt", { ascending: false }).limit(30),
    ownBookings,
  ]);
  const notifications = ((rows ?? []) as NavNotification[]).map((item) => ({ ...item, readAt: item.readAt ?? null }));
  const badges: Record<string, number> = {};
  const add = (path: string, count: number) => { if (count > 0) badges[path] = (badges[path] ?? 0) + count; };
  for (const item of notifications) {
    if (item.readAt || !item.href) continue;
    const path = item.href.split(/[?#]/)[0];
    add(path.startsWith("/conversa/") ? CHAT_PAGE[mode] : path, 1);
  }
  const conversationIds = ((bookings ?? []) as { conversation: { id: string } | { id: string }[] | null }[])
    .map((row) => (Array.isArray(row.conversation) ? row.conversation[0] : row.conversation)?.id).filter((id): id is string => Boolean(id));
  const unread = await getUnreadCounts(user.id, conversationIds);
  add(CHAT_PAGE[mode], [...unread.values()].reduce((sum, count) => sum + count, 0));
  return { notifications, badges };
}

// Opening a page counts its notifications as seen (the menu count goes away).
export async function markPageNotificationsRead(userId: string, path: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (createSupabaseServiceClient() as any).from("Notification").update({ readAt: new Date().toISOString() }).eq("userId", userId).is("readAt", null).like("href", `${path}%`);
}
