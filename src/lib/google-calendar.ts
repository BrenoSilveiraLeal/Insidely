import "server-only";
import { createHash } from "node:crypto";
import { BookingStatus, Role } from "@/lib/domain";
import { getAppUrl } from "@/lib/app-url";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";

export function calendarReturnPath(raw: string | null, role?: Role) {
  const allowed = new Set(["/dashboard/agendamentos", "/dashboard/mensagens", "/consultor/consultas"]);
  if (raw && allowed.has(raw)) return raw;
  return role === Role.CONSULTANT ? "/consultor/consultas" : "/dashboard/agendamentos";
}

export function googleCalendarCallbackUrl(bookingId: string, userId: string, returnTo: string) {
  const next = new URL("/auth/google-calendar/complete", getAppUrl());
  next.searchParams.set("bookingId", bookingId);
  next.searchParams.set("userId", userId);
  next.searchParams.set("returnTo", returnTo);
  const callback = new URL("/auth/callback", getAppUrl());
  callback.searchParams.set("next", `${next.pathname}${next.search}`);
  return callback.toString();
}

export async function createParticipantCalendarEvent({ userId, bookingId, accessToken }: { userId: string; bookingId: string; accessToken: string }) {
  const service = createSupabaseServiceClient();
  const { data: appUser, error: userError } = await service.from("User").select("role").eq("id", userId).maybeSingle();
  if (userError || !appUser) throw new Error("calendar_user_not_found");

  let query = service.from("Booking").select("id, customerId, professionalProfileId, startsAt, durationMinutes, status, goals").eq("id", bookingId);
  if (appUser.role === Role.CONSULTANT) {
    const { data: profile, error } = await service.from("ProfessionalProfile").select("id").eq("userId", userId).maybeSingle();
    if (error || !profile) throw new Error("calendar_booking_not_found");
    query = query.eq("professionalProfileId", profile.id);
  } else {
    query = query.eq("customerId", userId);
  }
  const { data: booking, error: bookingError } = await query.maybeSingle();
  if (bookingError || !booking || booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.AWAITING_CONFIRMATION) throw new Error("calendar_booking_not_available");

  const start = new Date(booking.startsAt);
  if (!Number.isFinite(start.getTime())) throw new Error("calendar_invalid_date");
  const end = new Date(start.getTime() + booking.durationMinutes * 60_000);
  const roomUrl = `${getAppUrl()}/sala/${booking.id}`;
  const eventId = createHash("sha256").update(`insidely:${userId}:${booking.id}`).digest("hex").slice(0, 40);
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      id: eventId,
      summary: "Conversa na Insidely",
      description: ["Conversa profissional marcada pela Insidely.", booking.goals, `Sala protegida: ${roomUrl}`].filter(Boolean).join("\n\n"),
      location: roomUrl,
      start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 60 }, { method: "popup", minutes: 10 }] },
    }),
  });
  if (response.status === 409) return { eventUrl: `https://calendar.google.com/calendar/event?eid=${eventId}`, alreadyAdded: true };
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403 ? "calendar_permission_missing" : "calendar_event_creation_failed";
    console.error("google_calendar_event_failed", { bookingId, userId, status: response.status });
    throw new Error(message);
  }
  const event = await response.json() as { htmlLink?: string };
  return { eventUrl: event.htmlLink ?? "https://calendar.google.com/calendar/", alreadyAdded: false };
}
