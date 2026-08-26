import { afterEach, describe, expect, it } from "vitest";
import { createGoogleMeetSpace } from "./google-meet";

describe("Google Meet adapter", () => {
  const previous = { enabled: process.env.GOOGLE_MEET_ENABLED, mock: process.env.E2E_MOCK_EXTERNALS };

  afterEach(() => {
    process.env.GOOGLE_MEET_ENABLED = previous.enabled;
    process.env.E2E_MOCK_EXTERNALS = previous.mock;
  });

  it("returns a deterministic room in the external mock mode", async () => {
    process.env.GOOGLE_MEET_ENABLED = "true";
    process.env.E2E_MOCK_EXTERNALS = "true";
    await expect(createGoogleMeetSpace()).resolves.toBe("https://meet.google.com/e2e-insidely-room");
  });
});
