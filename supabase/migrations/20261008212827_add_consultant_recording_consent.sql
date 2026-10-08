alter table public."Booking"
  add column if not exists "consultantRecordingConsent" boolean not null default false;
