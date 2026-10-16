import { describe, expect, it } from "vitest";
import { buildConversationIcs } from "./calendar";

describe("buildConversationIcs", () => {
  const ics = buildConversationIcs({ id: "b1", startsAt: new Date("2026-10-20T15:00:00.000Z"), durationMinutes: 30, goals: "Rotina, cultura", meetingUrl: "https://meet.google.com/abc-defg-hij" });

  it("schedules the event in UTC with its duration", () => {
    expect(ics).toContain("DTSTART:20261020T150000Z");
    expect(ics).toContain("DTEND:20261020T153000Z");
  });

  it("includes the room link and a reminder 30 minutes before", () => {
    expect(ics).toContain("LOCATION:https://meet.google.com/abc-defg-hij");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("DESCRIPTION:Conversa profissional pela Insidely\\n\\nRotina\\, cultura");
  });
});
