import { describe, expect, it } from "vitest";
import { bookingCountdown } from "./format";

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
