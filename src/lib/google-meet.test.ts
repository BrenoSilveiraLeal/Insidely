import { afterEach, describe, expect, it, vi } from "vitest";
import { closeGoogleMeetSpace, createGoogleMeetSpace, ensureGoogleMeetForBooking } from "./google-meet";

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
    await expect(createGoogleMeetSpace()).resolves.toEqual({ url: "https://meet.google.com/e2e-insidely-room", name: null });
  });

  it("persists a Jitsi fallback when Google credentials are absent", async () => {
    process.env.GOOGLE_MEET_ENABLED = "false";
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REFRESH_TOKEN;
    const booking = { id: "booking-uuid", status: "CONFIRMED", startsAt: new Date(Date.now() - 60_000).toISOString(), durationMinutes: 30, meetingUrl: null as string | null, meetingClosedAt: null };
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: booking, error: null }) }) }),
        update: (value: { meetingUrl: string }) => ({ eq: () => ({ is: () => ({ select: () => ({ maybeSingle: async () => { booking.meetingUrl = value.meetingUrl; return { data: { meetingUrl: booking.meetingUrl }, error: null }; } }) }) }) }),
      }),
    };
    await expect(ensureGoogleMeetForBooking(supabase, booking.id)).resolves.toMatch(/^https:\/\/meet\.jit\.si\/Insidely-booking-uuid-[0-9a-f]{8}$/);
    expect(booking.meetingUrl).toMatch(/^https:\/\/meet\.jit\.si\/Insidely-booking-uuid-/);
  });

  it("does not create a room before the conversation starts", async () => {
    const booking = { id: "booking-uuid", status: "CONFIRMED", startsAt: new Date(Date.now() + 5 * 60_000).toISOString(), durationMinutes: 30, meetingUrl: null, meetingClosedAt: null };
    const update = vi.fn();
    const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: booking, error: null }) }) }), update }) };
    await expect(ensureGoogleMeetForBooking(supabase, booking.id)).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("creates an open Google Meet space when configured", async () => {
    process.env.GOOGLE_MEET_ENABLED = "true";
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REFRESH_TOKEN = "refresh";
    process.env.E2E_MOCK_EXTERNALS = "false";
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access", scope: "https://www.googleapis.com/auth/meetings.space.created" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "spaces/abc", meetingUri: "https://meet.google.com/abc-defg-hij" })));
    await expect(createGoogleMeetSpace()).resolves.toEqual({ url: "https://meet.google.com/abc-defg-hij", name: "spaces/abc" });
    const request = vi.mocked(globalThis.fetch).mock.calls.at(-1)?.[1];
    expect(JSON.parse(String(request?.body))).toEqual({ config: { accessType: "OPEN" } });
  });

  it("locks the space and ends the conference when closing", async () => {
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REFRESH_TOKEN = "refresh";
    process.env.E2E_MOCK_EXTERNALS = "false";
    // The access token may already be cached by the previous test, so answer by URL.
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => String(url).includes("oauth2")
      ? new Response(JSON.stringify({ access_token: "access", scope: "https://www.googleapis.com/auth/meetings.space.created" }))
      : new Response("{}", { status: String(url).endsWith(":endActiveConference") ? 400 : 200 }));
    await closeGoogleMeetSpace("spaces/abc");
    const calls = vi.mocked(globalThis.fetch).mock.calls.filter(([url]) => String(url).startsWith("https://meet.googleapis.com/"));
    expect(String(calls[0][0])).toBe("https://meet.googleapis.com/v2/spaces/abc?updateMask=config.accessType");
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ config: { accessType: "RESTRICTED" } });
    expect(String(calls[1][0])).toBe("https://meet.googleapis.com/v2/spaces/abc:endActiveConference");
  });
});
