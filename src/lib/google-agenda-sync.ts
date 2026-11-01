import "server-only";
import { getAppUrl } from "@/lib/app-url";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Google → app: every free Insidely slot that overlaps something busy in the consultant's Google
// calendar in the next 8 weeks is removed. Booked slots are never touched. Run on connecting and by
// the 5-minute job (lib/google-calendar-link.ts).
export const GOOGLE_FREEBUSY_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";

// Where connecting the Google Agenda can start from (and returns to).
export const CALENDAR_LINK_PAGES = ["/consultor/agenda", "/dashboard/configuracoes"] as const;
export function calendarLinkReturnPath(raw: string | null, consultant: boolean) {
  return CALENDAR_LINK_PAGES.find((page) => page === raw) ?? (consultant ? "/consultor/agenda" : "/dashboard/configuracoes");
}

export function agendaSyncCallbackUrl(userId: string, returnTo: string) {
  const callback = new URL("/auth/callback", getAppUrl());
  callback.searchParams.set("next", `/auth/google-agenda/complete?userId=${encodeURIComponent(userId)}&returnTo=${encodeURIComponent(returnTo)}`);
  return callback.toString();
}

export async function removeSlotsBusyInGoogle(userId: string, accessToken: string) {
  const now = new Date();
  const until = new Date(now.getTime() + 8 * 7 * 86_400_000);
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: now.toISOString(), timeMax: until.toISOString(), items: [{ id: "primary" }] }),
    cache: "no-store",
  });
  if (!response.ok) {
    // Keep Google's own reason (shown on /admin/status): "API not enabled" needs a fix in Google
    // Cloud, a missing scope only needs the consultant to tick the permission box.
    const body = (await response.text().catch(() => "")).slice(0, 400);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createSupabaseServiceClient() as any).from("ErrorEvent").insert({ path: "/auth/google-agenda", routeType: "google-freebusy", message: `freeBusy ${response.status}: ${body}` });
    if (/accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(body)) throw new Error("calendar_api_disabled");
    if (response.status === 401 || response.status === 403) throw new Error("calendar_permission_missing");
    throw new Error(`Google freeBusy failed: ${response.status}`);
  }
  const payload = await response.json() as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
  const busy = (payload.calendars?.primary?.busy ?? []).map((range) => ({ start: new Date(range.start).getTime(), end: new Date(range.end).getTime() }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseServiceClient() as any;
  const { data: profile } = await supabase.from("ProfessionalProfile").select("id").eq("userId", userId).maybeSingle();
  if (!profile) return 0;
  const { data: slots } = await supabase.from("Availability").select("id, startsAt, endsAt").eq("professionalProfileId", profile.id).eq("isBooked", false).gte("startsAt", now.toISOString()).lte("startsAt", until.toISOString());
  const toUtc = (value: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`).getTime();
  const overlapping = (slots ?? []).filter((slot: { startsAt: string; endsAt: string }) => busy.some((range) => toUtc(slot.startsAt) < range.end && toUtc(slot.endsAt) > range.start)).map((slot: { id: string }) => slot.id);
  if (overlapping.length) await supabase.from("Availability").delete().in("id", overlapping).eq("isBooked", false);
  return overlapping.length;
}
