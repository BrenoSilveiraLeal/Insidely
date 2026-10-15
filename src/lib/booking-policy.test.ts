import { describe, expect, it } from "vitest";
import { canRetryTransfer, canSendBookingMessage, isMeetingRoomOpen } from "./booking-policy";

describe("booking policy", () => {
  it("does not allow messages before payment confirmation", () => {
    expect(canSendBookingMessage("PENDING_PAYMENT")).toBe(false);
    expect(canSendBookingMessage("CONFIRMED")).toBe(true);
    expect(canSendBookingMessage("COMPLETED")).toBe(true);
  });

  it("allows transfer retries only for release-eligible states", () => {
    expect(canRetryTransfer("COMPLETED_RELEASE_PENDING", "TRANSFER_FAILED")).toBe(true);
    expect(canRetryTransfer("PENDING_PAYMENT", "TRANSFER_FAILED")).toBe(false);
    expect(canRetryTransfer("COMPLETED_RELEASE_PENDING", "PAID_HELD")).toBe(true);
  });
});


describe("meeting room window", () => {
  const startsAt = new Date("2026-10-20T15:00:00.000Z");

  it("opens ten minutes before and closes at the end of the booking", () => {
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T14:49:59.999Z"))).toBe(false);
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T14:50:00.000Z"))).toBe(true);
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T15:30:00.000Z"))).toBe(true);
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T15:30:00.001Z"))).toBe(false);
  });
});
