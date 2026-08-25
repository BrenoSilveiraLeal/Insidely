import { describe, expect, it } from "vitest";
import { canRetryTransfer, canSendBookingMessage } from "./booking-policy";

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
