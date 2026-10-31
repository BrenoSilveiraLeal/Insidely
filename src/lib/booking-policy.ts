
const RETRYABLE_PAYMENT_STATUSES = new Set(["HELD", "PAID_HELD", "TRANSFER_FAILED"]);

// The chat is only for the conversation itself: it opens 24 hours before the booked time (so the
// two people cannot keep talking off-schedule for days) and closes when the booked time ends.
export const CHAT_OPENS_BEFORE_MS = 24 * 60 * 60_000;

export function chatOpensAt(startsAt: Date) {
  return new Date(startsAt.getTime() - CHAT_OPENS_BEFORE_MS);
}

export function canSendBookingMessage(status: string, startsAt: Date, durationMinutes: number, now = new Date()) {
  return status === "CONFIRMED" && now >= chatOpensAt(startsAt) && now.getTime() <= startsAt.getTime() + durationMinutes * 60_000;
}

export function chatClosedReason(status: string) {
  return status === "CANCELLED" ? "Conversa cancelada" : status === "EXPIRED" ? "Prazo de pagamento expirado" : status === "NO_SHOW" ? "Conversa não aconteceu"
    : status === "DISPUTED" ? "Conversa em contestação" : status === "PENDING_PAYMENT" ? "Aguardando pagamento" : ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"].includes(status) ? "Conversa finalizada" : "Horário da conversa encerrado";
}

export function canRetryTransfer(bookingStatus: string, paymentStatus: string) {
  return ["AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"].includes(bookingStatus) && RETRYABLE_PAYMENT_STATUSES.has(paymentStatus);
}

// Mirrors expire_past_unpaid_bookings: 30 minutes after the request or the end of the conversation.
export function paymentDeadline(createdAt: Date, startsAt: Date, durationMinutes: number) {
  return new Date(Math.min(createdAt.getTime() + 30 * 60_000, startsAt.getTime() + durationMinutes * 60_000));
}

// The room opens exactly at the scheduled start (no early entry) and closes at the scheduled end.
export function meetingRoomState(startsAt: Date, durationMinutes: number, now = new Date()) {
  const openTime = startsAt.getTime();
  const closeTime = openTime + durationMinutes * 60_000;
  if (!Number.isFinite(openTime) || durationMinutes <= 0 || now.getTime() < openTime) return "upcoming" as const;
  if (now.getTime() <= closeTime) return "open" as const;
  return "ended" as const;
}

export function isMeetingRoomOpen(startsAt: Date, durationMinutes: number, now = new Date()) {
  return meetingRoomState(startsAt, durationMinutes, now) === "open";
}

// Mirrors create_review: the customer may rate the conversation once its scheduled end has passed.
const REVIEWABLE_BOOKING_STATUSES = new Set(["CONFIRMED", "AWAITING_CONFIRMATION", "COMPLETED_RELEASE_PENDING", "COMPLETED"]);

export function canReviewBooking(status: string, startsAt: Date, durationMinutes: number, now = new Date()) {
  return REVIEWABLE_BOOKING_STATUSES.has(status) && startsAt.getTime() + durationMinutes * 60_000 <= now.getTime();
}

// A free slot can still be booked until 5 minutes after it starts (the same rule as the
// booking RPC); after that it is no longer offered, on the profile or in the consultant's agenda.
export const SLOT_BOOKING_GRACE_MS = 5 * 60_000;

export function isSlotStillBookable(slot: { startsAt: Date; isBooked: boolean }, now = new Date()) {
  return !slot.isBooked && slot.startsAt.getTime() > now.getTime() - SLOT_BOOKING_GRACE_MS;
}
