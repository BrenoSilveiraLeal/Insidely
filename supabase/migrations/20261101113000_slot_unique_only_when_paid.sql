-- A slot stays open until paid (20261101109000), so several requests awaiting payment may point at
-- the same slot. Only one booking past the payment step can hold it; the payment itself refuses a
-- slot already taken ('slot_taken').
drop index if exists public.booking_active_availability_key;
create unique index if not exists booking_paid_availability_key on public."Booking" ("availabilityId")
  where status not in ('EXPIRED'::public."BookingStatus", 'CANCELLED'::public."BookingStatus", 'PENDING_PAYMENT'::public."BookingStatus");
