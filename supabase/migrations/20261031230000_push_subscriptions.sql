-- Web push (installed app / browser notifications): one row per device that allowed notifications.
create table if not exists public."PushSubscription" (
  endpoint text primary key,
  "userId" text not null references public."User"(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists push_subscription_user_idx on public."PushSubscription" ("userId");
alter table public."PushSubscription" enable row level security;
revoke all on public."PushSubscription" from public, anon, authenticated;
-- Notifications already pushed (the 5-minute job pushes the new ones).
alter table public."Notification" add column if not exists "pushSentAt" timestamp(3) without time zone;
