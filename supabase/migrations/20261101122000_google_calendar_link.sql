-- Google Agenda linked once (lib/google-calendar-link.ts): the refresh token from the consent,
-- encrypted by the app, lets the 5-minute job push confirmed conversations to the person's Google
-- calendar, take cancelled ones off it, and (consultants) remove free slots that clash with it.
-- Only the service role reads these tables (RLS on, no policies).
create table if not exists public."GoogleCalendarLink" (
  "userId" text primary key references public."User"(id) on delete cascade,
  "refreshToken" text not null,
  "googleEmail" text,
  "connectedAt" timestamptz not null default now(),
  "lastSyncAt" timestamptz,
  "lastError" text
);
alter table public."GoogleCalendarLink" enable row level security;

-- Events the app put in someone's Google calendar, so a cancelled conversation can be taken off.
create table if not exists public."CalendarEvent" (
  "bookingId" text not null references public."Booking"(id) on delete cascade,
  "userId" text not null references public."User"(id) on delete cascade,
  "eventId" text not null,
  "createdAt" timestamptz not null default now(),
  primary key ("bookingId", "userId")
);
alter table public."CalendarEvent" enable row level security;
