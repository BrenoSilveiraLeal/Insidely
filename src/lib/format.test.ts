import { describe, expect, it } from "vitest";
import { bookingCountdown, meetingRoomOpeningText, parseDbDate } from "./format";

describe("booking countdown", () => {
  const now = new Date("2026-10-08T15:00:00-03:00");

  it("shows the remaining calendar days in São Paulo", () => {
    expect(bookingCountdown("2026-10-10T16:00:00-03:00", now)).toBe("Daqui a 2 dias");
    expect(bookingCountdown("2026-10-09T09:00:00-03:00", now)).toBe("Amanhã");
  });

  it("shows today's local time and marks past meetings expired", () => {
    expect(bookingCountdown("2026-10-08T17:30:00-03:00", now)).toBe("Hoje · 17:30");
    expect(bookingCountdown("2026-10-08T14:59:00-03:00", now)).toBe("Expirado");
  });
});

describe("meeting room opening label", () => {
  it("uses Brasília time and day/month", () => {
    expect(meetingRoomOpeningText("2026-10-20T15:00:00.000Z")).toBe("A sala abre às 11:50 de 20/10, 10 minutos antes da conversa.");
  });
});

describe("parseDbDate", () => {
  it("reads offset-less database timestamps as UTC", () => {
    expect(parseDbDate("2026-10-16T01:54:04.945").toISOString()).toBe("2026-10-16T01:54:04.945Z");
    expect(parseDbDate("2026-10-16 01:54:04").toISOString()).toBe("2026-10-16T01:54:04.000Z");
  });

  it("keeps explicit offsets", () => {
    expect(parseDbDate("2026-10-16T01:54:04+00:00").toISOString()).toBe("2026-10-16T01:54:04.000Z");
    expect(parseDbDate("2026-10-15T22:54:04-03:00").toISOString()).toBe("2026-10-16T01:54:04.000Z");
  });
});
