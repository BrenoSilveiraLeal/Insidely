-- Automatic warnings and appeals.
-- 1) A message refused by the chat moderation (contact, payment off the platform, offensive language)
--    gives the sender a warning automatically, at most one per 24 hours: several attempts in a row are
--    one warning. Automatic warnings have no staff author.
-- 2) A person can appeal a warning or a suspension. Support decides: accepted, the warning (or the
--    suspension, lifting it) is removed from the account; rejected, it stays.

alter table public."AccountWarning" alter column "adminUserId" drop not null;
alter table public."AccountWarning" add column if not exists automatic boolean not null default false;

create table if not exists public."SanctionAppeal" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references public."User"(id) on delete cascade,
  kind text not null check (kind in ('WARNING', 'SUSPENSION')),
  "warningId" text references public."AccountWarning"(id) on delete set null,
  "suspensionId" text references public."AccountSuspension"(id) on delete set null,
  -- What was appealed, kept after an accepted appeal removes the warning or suspension itself.
  "sanctionReason" text not null,
  "sanctionAt" timestamp(3) without time zone not null,
  reason text not null check (length(reason) between 20 and 2000),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REJECTED')),
  "staffNote" text,
  "decidedBy" text references public."User"(id) on delete set null,
  "decidedAt" timestamp(3) without time zone,
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists sanction_appeal_status_idx on public."SanctionAppeal" (status, "createdAt");
create index if not exists sanction_appeal_user_idx on public."SanctionAppeal" ("userId", "createdAt" desc);
-- One appeal per warning or suspension.
create unique index if not exists sanction_appeal_warning_once on public."SanctionAppeal" ("warningId") where "warningId" is not null;
create unique index if not exists sanction_appeal_suspension_once on public."SanctionAppeal" ("suspensionId") where "suspensionId" is not null;
alter table public."SanctionAppeal" enable row level security;
revoke all on public."SanctionAppeal" from public, anon, authenticated;
