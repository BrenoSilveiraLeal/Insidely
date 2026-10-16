-- Reminders about an hour before each confirmed conversation (e-mail + in-app notification).
-- Vercel Hobby only allows daily crons, so pg_cron pings the app every 5 minutes through pg_net.
-- The endpoint is idempotent: each booking is claimed once through "reminderSentAt".
alter table public."Booking" add column if not exists "reminderSentAt" timestamp(3) without time zone;

create index if not exists booking_reminder_due_idx on public."Booking" ("startsAt")
  where status = 'CONFIRMED'::public."BookingStatus" and "reminderSentAt" is null;

create extension if not exists pg_net;
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'insidely-conversation-reminders';
select cron.schedule(
  'insidely-conversation-reminders',
  '*/5 * * * *',
  $$ select net.http_get(url := 'https://insidely.vercel.app/api/cron/reminders', timeout_milliseconds := 20000); $$
);
