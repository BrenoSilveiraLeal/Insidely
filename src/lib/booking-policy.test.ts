import { describe, expect, it } from "vitest";
import { canRetryTransfer, canReviewBooking, canSendBookingMessage, isMeetingRoomOpen, paymentDeadline } from "./booking-policy";

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

  it("opens exactly at the start and closes at the end of the booking", () => {
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T14:50:00.000Z"))).toBe(false);
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T14:59:59.999Z"))).toBe(false);
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T15:00:00.000Z"))).toBe(true);
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T15:30:00.000Z"))).toBe(true);
    expect(isMeetingRoomOpen(startsAt, 30, new Date("2026-10-20T15:30:00.001Z"))).toBe(false);
  });
});

describe("payment deadline", () => {
  it("allows 30 minutes for future bookings", () => {
    expect(paymentDeadline(new Date("2026-10-20T12:00:00.000Z"), new Date("2026-10-21T15:00:00.000Z"), 30)).toEqual(new Date("2026-10-20T12:30:00.000Z"));
  });

  it("keeps instant bookings payable until the conversation ends", () => {
    expect(paymentDeadline(new Date("2026-10-20T15:20:00.000Z"), new Date("2026-10-20T15:00:00.000Z"), 30)).toEqual(new Date("2026-10-20T15:30:00.000Z"));
  });
});

describe("review eligibility", () => {
  const startsAt = new Date("2026-10-20T15:00:00.000Z");

  it("opens the review once the scheduled conversation ends", () => {
    expect(canReviewBooking("CONFIRMED", startsAt, 30, new Date("2026-10-20T15:29:59.999Z"))).toBe(false);
    expect(canReviewBooking("CONFIRMED", startsAt, 30, new Date("2026-10-20T15:30:00.000Z"))).toBe(true);
    expect(canReviewBooking("COMPLETED", startsAt, 30, new Date("2026-10-21T15:00:00.000Z"))).toBe(true);
  });

  it("never opens the review for unpaid, cancelled or disputed bookings", () => {
    const later = new Date("2026-10-21T15:00:00.000Z");
    for (const status of ["PENDING_PAYMENT", "CANCELLED", "EXPIRED", "DISPUTED"]) expect(canReviewBooking(status, startsAt, 30, later)).toBe(false);
  });
});
