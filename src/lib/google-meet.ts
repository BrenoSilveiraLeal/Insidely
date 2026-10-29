import { isMeetingRoomOpen, meetingRoomState } from "./booking-policy";
import { parseDbDate } from "./format";

const MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.created";

type MeetSpaceResponse = { name?: string; meetingUri?: string; meetingSpace?: { meetingUri?: string } };

// Access tokens last about an hour; reusing one saves an OAuth round trip on every payment.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGoogleAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google OAuth failed: ${response.status}`);
  const payload = await response.json() as { access_token?: string; scope?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Google OAuth did not return an access token.");
  if (payload.scope && !payload.scope.split(" ").includes(MEET_SCOPE)) throw new Error("The Google refresh token is missing the Meet scope.");
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 3600) - 300) * 1000 };
  return payload.access_token;
}

// The fallback name carries a random part: a predictable "Insidely-<booking id>" room could be
// opened by anyone who knows the id, before the conversation starts.
export function getFallbackMeetingUrl(bookingId: string) {
  return `https://meet.jit.si/Insidely-${bookingId}-${crypto.randomUUID().slice(0, 8)}`;
}

export type MeetSpace = { url: string; name: string | null };

export async function createGoogleMeetSpace(): Promise<MeetSpace | null> {
  if (process.env.GOOGLE_MEET_ENABLED?.trim() !== "true") return null;
  if (process.env.E2E_MOCK_EXTERNALS === "true") return { url: "https://meet.google.com/e2e-insidely-room", name: null };
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return null;

  const response = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ config: { accessType: "OPEN" } }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google Meet space creation failed: ${response.status} ${await response.text()}`);
  const payload = await response.json() as MeetSpaceResponse;
  const url = payload.meetingUri ?? payload.meetingSpace?.meetingUri;
  if (!url || !url.startsWith("https://meet.google.com/")) throw new Error("Google Meet did not return a valid meeting URL.");
  return { url, name: payload.name?.startsWith("spaces/") ? payload.name : null };
}

type MeetParticipant = { signedinUser?: { displayName?: string }; anonymousUser?: { displayName?: string }; phoneUser?: { displayName?: string }; earliestStartTime?: string; latestEndTime?: string };

// Who Google Meet saw in the room (names as shown in Meet), kept with the booking as evidence.
export async function listGoogleMeetParticipants(name: string) {
  if (process.env.E2E_MOCK_EXTERNALS === "true") return [];
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return [];
  const headers = { Authorization: `Bearer ${accessToken}` };
  const records = await fetch(`https://meet.googleapis.com/v2/conferenceRecords?filter=${encodeURIComponent(`space.name="${name}"`)}`, { headers, cache: "no-store" });
  if (!records.ok) throw new Error(`Google Meet conference lookup failed: ${records.status} ${await records.text()}`);
  const { conferenceRecords = [] } = await records.json() as { conferenceRecords?: { name: string }[] };
  const participants: { name: string; joinedAt: string | null; leftAt: string | null }[] = [];
  for (const record of conferenceRecords) {
    const response = await fetch(`https://meet.googleapis.com/v2/${record.name}/participants?pageSize=100`, { headers, cache: "no-store" });
    if (!response.ok) throw new Error(`Google Meet participants lookup failed: ${response.status} ${await response.text()}`);
    const payload = await response.json() as { participants?: MeetParticipant[] };
    for (const item of payload.participants ?? []) participants.push({ name: item.signedinUser?.displayName ?? item.anonymousUser?.displayName ?? item.phoneUser?.displayName ?? "Participante", joinedAt: item.earliestStartTime ?? null, leftAt: item.latestEndTime ?? null });
  }
  return participants;
}

// After the conversation the space is locked and anyone still inside is removed. RESTRICTED means
// only invitees join directly; nobody is invited, so a saved link can only "ask to join", and the
// room owner (the project account) is never there to let anyone in.
export async function closeGoogleMeetSpace(name: string) {
  if (process.env.E2E_MOCK_EXTERNALS === "true") return;
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) throw new Error("Google credentials are not configured.");
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const patch = await fetch(`https://meet.googleapis.com/v2/${name}?updateMask=config.accessType`, { method: "PATCH", headers, body: JSON.stringify({ config: { accessType: "RESTRICTED" } }), cache: "no-store" });
  if (!patch.ok) throw new Error(`Google Meet space lock failed: ${patch.status} ${await patch.text()}`);
  // Fails with 400/404 when nobody is in the room, which is the usual case.
  const end = await fetch(`https://meet.googleapis.com/v2/${name}:endActiveConference`, { method: "POST", headers, body: "{}", cache: "no-store" });
  if (!end.ok && ![400, 404].includes(end.status)) throw new Error(`Google Meet conference end failed: ${end.status} ${await end.text()}`);
}

// The room is only created once the conversation has started (see isMeetingRoomOpen), so no link
// exists before the scheduled time and nobody can enter early.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureGoogleMeetForBooking(supabase: any, bookingId: string, now = new Date()) {
  const { data: booking, error } = await supabase.from("Booking").select("id, status, startsAt, durationMinutes, meetingUrl, meetingClosedAt").eq("id", bookingId).maybeSingle();
  if (error) throw new Error("meet_booking_lookup: " + error.message);
  if (!booking || booking.meetingClosedAt) return null;
  if (!isMeetingRoomOpen(parseDbDate(booking.startsAt), booking.durationMinutes, now)) return null;
  if (booking.meetingUrl) return booking.meetingUrl;
  if (!["CONFIRMED", "AWAITING_CONFIRMATION"].includes(booking.status)) return null;

  let space: MeetSpace | null = null;
  if (process.env.GOOGLE_MEET_ENABLED?.trim() === "true") {
    try { space = await createGoogleMeetSpace(); }
    catch (error) { console.error("google_meet_creation_failed", { bookingId, error }); }
  }
  space ??= { url: getFallbackMeetingUrl(bookingId), name: null };

  const { data: updated, error: updateError } = await supabase.from("Booking")
    .update({ meetingUrl: space.url, meetingSpaceName: space.name, updatedAt: new Date().toISOString() })
    .eq("id", bookingId).is("meetingUrl", null).select("meetingUrl").maybeSingle();
  if (updateError) throw new Error("meet_booking_update: " + updateError.message);
  if (updated?.meetingUrl) return updated.meetingUrl;

  // Another request created the room first; this space is never shared, so close it right away.
  if (space.name) await closeGoogleMeetSpace(space.name).catch((closeError) => console.error("google_meet_duplicate_close_failed", { bookingId, error: closeError }));
  const { data: latest, error: latestError } = await supabase.from("Booking")
    .select("meetingUrl").eq("id", bookingId).maybeSingle();
  if (latestError) throw new Error("meet_booking_refresh: " + latestError.message);
  return latest?.meetingUrl ?? null;
}

// Called by the 5-minute cron: locks the Google space of every conversation whose time is over.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function closeEndedMeetings(supabase: any, now = new Date()) {
  const { data: bookings, error } = await supabase.from("Booking")
    .select("id, startsAt, durationMinutes, meetingSpaceName")
    .not("meetingSpaceName", "is", null).is("meetingClosedAt", null).lte("startsAt", now.toISOString())
    .order("startsAt", { ascending: true }).limit(50);
  if (error) { console.error("meeting_close_lookup_failed", { error }); return 0; }
  let closed = 0;
  for (const booking of bookings ?? []) {
    if (meetingRoomState(parseDbDate(booking.startsAt), booking.durationMinutes, now) !== "ended") continue;
    try {
      const participants = await listGoogleMeetParticipants(booking.meetingSpaceName).catch((listError) => { console.error("google_meet_participants_failed", { bookingId: booking.id, error: listError }); return null; });
      await closeGoogleMeetSpace(booking.meetingSpaceName);
      await supabase.from("Booking").update({ meetingClosedAt: now.toISOString(), ...(participants ? { meetingParticipants: participants } : {}) }).eq("id", booking.id).is("meetingClosedAt", null);
      closed++;
    } catch (closeError) {
      console.error("google_meet_close_failed", { bookingId: booking.id, error: closeError });
    }
  }
  return closed;
}
