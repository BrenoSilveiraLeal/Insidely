const MESSAGEABLE_BOOKING_STATUSES = new Set(["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED"]);
const RETRYABLE_PAYMENT_STATUSES = new Set(["HELD", "PAID_HELD", "TRANSFER_FAILED"]);

export function canSendBookingMessage(status: string) {
  return MESSAGEABLE_BOOKING_STATUSES.has(status);
}

export function canRetryTransfer(bookingStatus: string, paymentStatus: string) {
  return ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"].includes(bookingStatus) && RETRYABLE_PAYMENT_STATUSES.has(paymentStatus);
}

export function isMeetingRoomOpen(startsAt: Date, durationMinutes: number, now = new Date()) {
  const opensAt = startsAt.getTime() - 10 * 60_000;
  const closesAt = startsAt.getTime() + durationMinutes * 60_000;
  return Number.isFinite(opensAt) && durationMinutes > 0 && now.getTime() >= opensAt && now.getTime() <= closesAt;
}

export function meetingRoomState(startsAt: Date, durationMinutes: number, now = new Date()) {
  const openTime = startsAt.getTime() - 10 * 60_000;
  const closeTime = startsAt.getTime() + durationMinutes * 60_000;
  if (!Number.isFinite(openTime) || durationMinutes <= 0) return "upcoming" as const;
  if (now.getTime() < openTime) return "upcoming" as const;
  if (now.getTime() <= closeTime) return "open" as const;
  return "ended" as const;
}
