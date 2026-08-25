const MESSAGEABLE_BOOKING_STATUSES = new Set(["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED"]);
const RETRYABLE_PAYMENT_STATUSES = new Set(["HELD", "PAID_HELD", "TRANSFER_FAILED"]);

export function canSendBookingMessage(status: string) {
  return MESSAGEABLE_BOOKING_STATUSES.has(status);
}

export function canRetryTransfer(bookingStatus: string, paymentStatus: string) {
  return ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"].includes(bookingStatus) && RETRYABLE_PAYMENT_STATUSES.has(paymentStatus);
}
