
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

// Mirrors expire_past_unpaid_bookings: choosing a time slot holds it for 5 minutes (message requests,
// which have no slot, get 30), or until the end of the conversation if that comes first.
export const SLOT_HOLD_MINUTES = 5;
export const MESSAGE_PAYMENT_MINUTES = 30;
export function holdMinutesFor(format?: string | null) {
  return format === "MESSAGE" ? MESSAGE_PAYMENT_MINUTES : SLOT_HOLD_MINUTES;
}
export function paymentDeadline(createdAt: Date, startsAt: Date, durationMinutes: number, holdMinutes = SLOT_HOLD_MINUTES) {
  return new Date(Math.min(createdAt.getTime() + holdMinutes * 60_000, startsAt.getTime() + durationMinutes * 60_000));
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

// Rescheduling (customer, video conversations): once, up to 2 hours before the start, to another free
// slot of the same consultant; a fixed fee plus any price difference (no refund for a cheaper slot).
// Enforced by request_booking_reschedule (migration 20261101104000).
export const RESCHEDULE_FEE_CENTS = 500;
export const RESCHEDULE_MIN_HOURS = 2;
export const RESCHEDULE_HOLD_MINUTES = 30;
export function canRescheduleBooking(booking: { status: string; format?: string | null; startsAt: Date }, alreadyRescheduled: boolean, now = new Date()) {
  return booking.status === "CONFIRMED" && (booking.format ?? "VIDEO") === "VIDEO" && !alreadyRescheduled && booking.startsAt.getTime() - now.getTime() >= RESCHEDULE_MIN_HOURS * 3_600_000;
}
// A free slot of the same consultant, at least 10 minutes ahead and not the current time.
export function isRescheduleSlot(slot: { startsAt: Date; isBooked: boolean }, currentStartsAt: Date, now = new Date()) {
  return !slot.isBooked && slot.startsAt.getTime() >= now.getTime() + 10 * 60_000 && slot.startsAt.getTime() !== currentStartsAt.getTime();
}
export function rescheduleDifferenceCents(newPriceCents: number, paidSubtotalCents: number) {
  return Math.max(0, newPriceCents - paidSubtotalCents);
}

// The chat (the only conversation format): opens when paid. The consultant has 24 hours for the
// first answer, or the customer is refunded; afterwards it closes after 24 hours with nobody writing,
// or 72 hours after opening (close_idle_message_chats, migration 20261110100000).
// Platform fee on top of the consultant's price: 20%, at least R$ 5,00 (public.chat_fee_cents, migration
// 20261110130000). The consultant receives the full price; the customer pays price + fee.
export const CHAT_FEE_RATE = 0.2;
export const CHAT_FEE_MIN_CENTS = 500;
export function chatFeeCents(priceCents: number) {
  return Math.max(CHAT_FEE_MIN_CENTS, Math.round(priceCents * CHAT_FEE_RATE));
}
export const CHAT_FIRST_ANSWER_HOURS = 24;
export const CHAT_IDLE_HOURS = 24;
export const CHAT_MAX_HOURS = 72;
export const MESSAGE_WINDOW_MINUTES = CHAT_MAX_HOURS * 60;
// Older requests ("Perguntas por mensagem") ended with this automatic thank-you; kept to show them.
export const MESSAGE_CLOSING_TEXT = "Obrigado pelos esclarecimentos! Essas eram todas as minhas perguntas.";
export function isMessageClosing(message: { body: string; automatic?: boolean | null }) {
  return Boolean(message.automatic) && message.body === MESSAGE_CLOSING_TEXT;
}
// Suggested price for the message format: 60% of the 30-minute video price.
export function suggestedMessagePriceCents(price30Cents: number) {
  return Math.max(1000, Math.round(price30Cents * 0.6 / 100) * 100);
}

// Order of conversation lists: message requests in progress first (urgent), then conversations still
// to happen, nearest first, then ones that already happened and are still to settle (awaiting
// confirmation, disputed), most recent first, then finished ones (completed, cancelled, expired,
// no-show), most recent first. The consultant's list does the same in get_consultant_bookings.
const UPCOMING = ["PENDING_PAYMENT", "CONFIRMED", "IN_PROGRESS"];
const TO_SETTLE = ["AWAITING_CONFIRMATION", "DISPUTED"];
export function compareBookingsForList(a: { status: string; format?: string; startsAt: Date }, b: { status: string; format?: string; startsAt: Date }) {
  const group = (item: typeof a) => item.format === "MESSAGE" && item.status === "CONFIRMED" ? 0 : UPCOMING.includes(item.status) ? 1 : TO_SETTLE.includes(item.status) ? 2 : 3;
  const byGroup = group(a) - group(b);
  if (byGroup) return byGroup;
  return group(a) < 2 ? a.startsAt.getTime() - b.startsAt.getTime() : b.startsAt.getTime() - a.startsAt.getTime();
}
