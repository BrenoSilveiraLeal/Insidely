const MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.created";

type MeetSpaceResponse = { meetingUri?: string; meetingSpace?: { meetingUri?: string } };

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

export function getFallbackMeetingUrl(bookingId: string) {
  return "https://meet.jit.si/Insidely-" + bookingId;
}

export async function createGoogleMeetSpace() {
  if (process.env.GOOGLE_MEET_ENABLED?.trim() !== "true") return null;
  if (process.env.E2E_MOCK_EXTERNALS === "true") return "https://meet.google.com/e2e-insidely-room";
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
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureGoogleMeetForBooking(supabase: any, bookingId: string) {
  const { data: booking, error } = await supabase.from("Booking").select("id, status, meetingUrl").eq("id", bookingId).maybeSingle();
  if (error) throw new Error("meet_booking_lookup: " + error.message);
  if (!booking) return null;
  if (booking.meetingUrl) return booking.meetingUrl;
  if (!["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"].includes(booking.status)) return null;

  let meetingUrl: string | null = null;
  if (process.env.GOOGLE_MEET_ENABLED?.trim() === "true") {
    try { meetingUrl = await createGoogleMeetSpace(); }
    catch (error) { console.error("google_meet_creation_failed", { bookingId, error }); }
  }
  meetingUrl ??= getFallbackMeetingUrl(bookingId);

  const { data: updated, error: updateError } = await supabase.from("Booking")
    .update({ meetingUrl, updatedAt: new Date().toISOString() })
    .eq("id", bookingId).is("meetingUrl", null).select("meetingUrl").maybeSingle();
  if (updateError) throw new Error("meet_booking_update: " + updateError.message);
  if (updated?.meetingUrl) return updated.meetingUrl;

  const { data: latest, error: latestError } = await supabase.from("Booking")
    .select("meetingUrl").eq("id", bookingId).maybeSingle();
  if (latestError) throw new Error("meet_booking_refresh: " + latestError.message);
  return latest?.meetingUrl ?? meetingUrl;
}
