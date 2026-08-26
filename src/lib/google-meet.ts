const MEET_SCOPE = "https://www.googleapis.com/auth/meetings.space.created";

type MeetSpaceResponse = { meetingUri?: string; meetingSpace?: { meetingUri?: string } };

async function getGoogleAccessToken() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google OAuth failed: ${response.status}`);
  const payload = await response.json() as { access_token?: string; scope?: string };
  if (!payload.access_token) throw new Error("Google OAuth did not return an access token.");
  if (payload.scope && !payload.scope.split(" ").includes(MEET_SCOPE)) throw new Error("The Google refresh token is missing the Meet scope.");
  return payload.access_token;
}

export async function createGoogleMeetSpace() {
  if (process.env.GOOGLE_MEET_ENABLED !== "true") return null;
  if (process.env.E2E_MOCK_EXTERNALS === "true") return "https://meet.google.com/e2e-insidely-room";
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return null;

  const response = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
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
  if (process.env.GOOGLE_MEET_ENABLED !== "true") return null;
  const { data: booking, error } = await supabase.from("Booking").select("id, meetingUrl").eq("id", bookingId).maybeSingle();
  if (error) throw new Error(`meet_booking_lookup: ${error.message}`);
  if (!booking || booking.meetingUrl) return booking?.meetingUrl ?? null;
  const meetingUrl = await createGoogleMeetSpace();
  if (!meetingUrl) return null;
  const { error: updateError } = await supabase.from("Booking").update({ meetingUrl, updatedAt: new Date().toISOString() }).eq("id", bookingId).is("meetingUrl", null);
  if (updateError) throw new Error(`meet_booking_update: ${updateError.message}`);
  return meetingUrl;
}
