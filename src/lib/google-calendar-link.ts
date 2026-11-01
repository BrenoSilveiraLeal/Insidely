import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { calendarEventId, createParticipantCalendarEvent, recordGoogleError } from "@/lib/google-calendar";
import { removeSlotsBusyInGoogle } from "@/lib/google-agenda-sync";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Google Agenda linked once (migration 20261101122000). The consent gives a refresh token, kept
// encrypted; with it the 5-minute job (api/cron/reminders) keeps both sides in step:
// - app → Google: every confirmed video conversation goes into the person's Google calendar, and
//   leaves it when the conversation is cancelled;
// - Google → app (consultants): free Insidely slots that clash with something busy are removed.
// The token is refreshed with the same OAuth client as the Google sign-in (GOOGLE_CLIENT_ID/SECRET).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = () => createSupabaseServiceClient() as any;

// Encrypted with a key derived from the service role key (already a server-only secret): a leaked
// table row alone is useless. Rotating that key only means people connect again.
function tokenKey() {
  return createHash("sha256").update(`insidely-calendar:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest();
}
function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64")).join(".");
}
function decrypt(value: string) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export type CalendarLink = { googleEmail: string | null; connectedAt: string; lastSyncAt: string | null; lastError: string | null };

export async function getCalendarLink(userId: string): Promise<CalendarLink | null> {
  const { data } = await service().from("GoogleCalendarLink").select("googleEmail, connectedAt, lastSyncAt, lastError").eq("userId", userId).maybeSingle();
  return data ?? null;
}

export async function saveCalendarLink(userId: string, refreshToken: string, googleEmail: string | null) {
  const { error } = await service().from("GoogleCalendarLink").upsert({ userId, refreshToken: encrypt(refreshToken), googleEmail, connectedAt: new Date().toISOString(), lastError: null }, { onConflict: "userId" });
  if (error) throw new Error(`calendar_link_save_failed: ${error.message}`);
}

export async function removeCalendarLink(userId: string) {
  await service().from("GoogleCalendarLink").delete().eq("userId", userId);
}

// A fresh access token, or null when the person revoked the access in their Google account (the
// link is then dropped and the page asks them to connect again).
async function accessTokenFor(userId: string) {
  const { data } = await service().from("GoogleCalendarLink").select("refreshToken").eq("userId", userId).maybeSingle();
  if (!data) return null;
  let refreshToken: string;
  try { refreshToken = decrypt(data.refreshToken); } catch { await removeCalendarLink(userId); return null; }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "" }),
    cache: "no-store",
  });
  if (response.ok) return (await response.json() as { access_token: string }).access_token;
  const body = (await response.text().catch(() => "")).slice(0, 300);
  await recordGoogleError("google-calendar-link", `token refresh ${response.status}: ${body}`);
  if (/invalid_grant/.test(body)) { await removeCalendarLink(userId); return null; }
  throw new Error("calendar_token_refresh_failed");
}

// Added while still ahead or just held; kept in the calendar once completed; removed otherwise.
const TO_ADD = ["CONFIRMED", "AWAITING_CONFIRMATION"];
const IN_CALENDAR = [...TO_ADD, "COMPLETED_RELEASE_PENDING", "COMPLETED"];

// One sync of one person, both directions. Returns what changed (shown after connecting).
export async function syncCalendar(userId: string) {
  const supabase = service();
  const result = { added: 0, removedEvents: 0, removedSlots: 0 };
  let failure: unknown = null;
  try {
    const token = await accessTokenFor(userId);
    if (!token) return result;
    const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", userId).maybeSingle();
    const now = Date.now();
    // Video conversations ahead (or from the last day) where this person takes part. "Perguntas por
    // mensagem" have no meeting time, so they stay out of the calendar.
    let query = supabase.from("Booking").select("id, status, format").gte("startsAt", new Date(now - 86_400_000).toISOString()).limit(200);
    query = profile ? query.or(`customerId.eq.${userId},professionalProfileId.eq.${profile.id}`) : query.eq("customerId", userId);
    const [{ data: bookings }, { data: pushed }] = await Promise.all([query, supabase.from("CalendarEvent").select("bookingId, eventId").eq("userId", userId)]);
    const done = new Map(((pushed ?? []) as { bookingId: string; eventId: string }[]).map((row) => [row.bookingId, row.eventId]));
    for (const booking of (bookings ?? []) as { id: string; status: string; format: string | null }[]) {
      if (booking.format === "MESSAGE" || !TO_ADD.includes(booking.status) || done.has(booking.id)) continue;
      // One conversation that fails does not hold back the others; the reason is kept for the page.
      try {
        await createParticipantCalendarEvent({ userId, bookingId: booking.id, accessToken: token });
        await supabase.from("CalendarEvent").upsert({ bookingId: booking.id, userId, eventId: calendarEventId(userId, booking.id) }, { onConflict: "bookingId,userId" });
        result.added++;
      } catch (error) { failure ??= error; }
    }
    // Conversations that will no longer happen leave the Google calendar.
    if (done.size) {
      const { data: gone } = await supabase.from("Booking").select("id").in("id", [...done.keys()]).not("status", "in", `(${IN_CALENDAR.join(",")})`);
      for (const { id } of (gone ?? []) as { id: string }[]) {
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${done.get(id)}?sendUpdates=none`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (!response.ok && response.status !== 404 && response.status !== 410) { await recordGoogleError("google-calendar-link", `events.delete ${response.status}`); continue; }
        await supabase.from("CalendarEvent").delete().eq("bookingId", id).eq("userId", userId);
        result.removedEvents++;
      }
    }
    if (profile) result.removedSlots = await removeSlotsBusyInGoogle(userId, token);
    if (failure) throw failure;
    await supabase.from("GoogleCalendarLink").update({ lastSyncAt: new Date().toISOString(), lastError: null }).eq("userId", userId);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await supabase.from("GoogleCalendarLink").update({ lastSyncAt: new Date().toISOString(), lastError: reason.slice(0, 200) }).eq("userId", userId);
    throw error;
  }
  return result;
}

// Called by the 5-minute job: everyone linked, each at most once every 4 minutes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncLinkedCalendars(supabase: any, now: Date) {
  const { data: links } = await supabase.from("GoogleCalendarLink").select("userId, lastSyncAt").or(`lastSyncAt.is.null,lastSyncAt.lt.${new Date(now.getTime() - 4 * 60_000).toISOString()}`).order("lastSyncAt", { ascending: true, nullsFirst: true }).limit(20);
  let synced = 0;
  for (const link of (links ?? []) as { userId: string }[]) {
    try { await syncCalendar(link.userId); synced++; } catch (error) { console.error("calendar_sync_failed", { userId: link.userId, error }); }
  }
  return synced;
}

// What the page says when the last sync failed.
export function calendarErrorText(reason: string | null) {
  if (!reason) return null;
  if (reason.includes("calendar_api_disabled") || reason.includes("calendar_permission_missing")) return "O Google recusou o acesso à agenda. Se o problema continuar, desconecte e conecte de novo marcando todas as permissões.";
  return "A última sincronização falhou. Tentamos de novo em alguns minutos.";
}
