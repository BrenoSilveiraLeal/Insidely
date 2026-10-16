-- "Booking_availabilityId_key" allowed one booking per slot forever. Expired and cancelled bookings
-- release their slot (it shows up as available again) but kept the reference, so booking that slot
-- again failed with a unique violation. Only one *active* booking per slot is required.
drop index if exists public."Booking_availabilityId_key";
create unique index if not exists booking_active_availability_key on public."Booking" ("availabilityId")
  where status not in ('EXPIRED'::public."BookingStatus", 'CANCELLED'::public."BookingStatus");
