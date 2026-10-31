-- A contest can end with part of the amount back to the customer (decided by support). The consultant's
-- transfer is then the share of what was not given back (lib/stripe-payments.ts releaseBookingTransfer).
alter table public."Booking" add column if not exists "refundedCents" integer not null default 0;
alter table public."Booking" drop constraint if exists booking_refunded_cents_range;
alter table public."Booking" add constraint booking_refunded_cents_range check ("refundedCents" >= 0 and "refundedCents" <= "totalCents");
