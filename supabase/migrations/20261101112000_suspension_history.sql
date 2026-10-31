-- Every suspension is recorded, so the graduated enforcement can count them: each 3 warnings bring a
-- 7-day suspension, and the 3rd suspension is a permanent ban (lib/enforcement.ts).
create table if not exists public."AccountSuspension" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references public."User"(id) on delete cascade,
  "adminUserId" text references public."User"(id) on delete set null,
  reason text not null,
  "endsAt" timestamp(3) without time zone,
  automatic boolean not null default false,
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists account_suspension_user_idx on public."AccountSuspension" ("userId", "createdAt" desc);
alter table public."AccountSuspension" enable row level security;
revoke all on public."AccountSuspension" from public, anon, authenticated;

-- Suspensions in force before this table existed count as one.
insert into public."AccountSuspension" ("userId", reason, "endsAt", "createdAt")
select u.id, coalesce(u."suspensionReason", 'Suspensão anterior ao histórico'), u."suspendedUntil", u."suspendedAt"
  from public."User" u
 where u."suspendedAt" is not null
   and not exists (select 1 from public."AccountSuspension" s where s."userId" = u.id);
