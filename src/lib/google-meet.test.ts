import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoogleMeetSpace, ensureGoogleMeetForBooking } from "./google-meet";

describe("Google Meet adapter", () => {
  const keys = ["GOOGLE_MEET_ENABLED", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "E2E_MOCK_EXTERNALS"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    for (const key of keys) { const value = previous[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns a deterministic room in the external mock mode", async () => {
    process.env.GOOGLE_MEET_ENABLED = "true";
    process.env.E2E_MOCK_EXTERNALS = "true";
    await expect(createGoogleMeetSpace()).resolves.toBe("https://meet.google.com/e2e-insidely-room");
  });

  it("persists a Jitsi fallback when Google credentials are absent", async () => {
    process.env.GOOGLE_MEET_ENABLED = "false";
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;
    const booking = { id: "booking-uuid", status: "CONFIRMED", meetingUrl: null as string | null };
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: booking, error: null }) }) }),
        update: (value: { meetingUrl: string }) => ({ eq: () => ({ is: () => ({ select: () => ({ maybeSingle: async () => { booking.meetingUrl = value.meetingUrl; return { data: { meetingUrl: booking.meetingUrl }, error: null }; } }) }) }) }),
      }),
    };
    await expect(ensureGoogleMeetForBooking(supabase, booking.id)).resolves.toBe("https://meet.jit.si/Insidely-booking-uuid");
    expect(booking.meetingUrl).toBe("https://meet.jit.si/Insidely-booking-uuid");
  });

  it("creates an open Google Meet space when configured", async () => {
    process.env.GOOGLE_MEET_ENABLED = "true";
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REFRESH_TOKEN = "refresh";
    process.env.E2E_MOCK_EXTERNALS = "false";
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access", scope: "https://www.googleapis.com/auth/meetings.space.created" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ meetingUri: "https://meet.google.com/abc-defg-hij" })));
    await expect(createGoogleMeetSpace()).resolves.toBe("https://meet.google.com/abc-defg-hij");
    const request = vi.mocked(globalThis.fetch).mock.calls[1][1];
    expect(JSON.parse(String(request?.body))).toEqual({ config: { accessType: "OPEN" } });
  });
});
