alter table public."Booking"
  add column if not exists "meetingUrl" text;

create index if not exists booking_meeting_url_idx
  on public."Booking" ("meetingUrl")
  where "meetingUrl" is not null;
