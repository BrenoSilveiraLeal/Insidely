-- Admin tools: action log, internal notes, case ownership and scheduled job history.

create table if not exists public."AdminActionLog" (
  id text primary key default gen_random_uuid()::text,
  "adminUserId" text references public."User"(id) on delete set null,
  action text not null,
  "targetUserId" text,
  detail text,
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists admin_action_log_created_idx on public."AdminActionLog" ("createdAt" desc);
alter table public."AdminActionLog" enable row level security;
revoke all on public."AdminActionLog" from public, anon, authenticated;

create table if not exists public."AdminNote" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references public."User"(id) on delete cascade,
  "adminUserId" text references public."User"(id) on delete set null,
  body text not null check (length(body) between 2 and 2000),
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists admin_note_user_idx on public."AdminNote" ("userId", "createdAt" desc);
alter table public."AdminNote" enable row level security;
revoke all on public."AdminNote" from public, anon, authenticated;

-- "report:<id>", "review:<id>" or "dispute:<bookingId>" -> admin who took the case.
create table if not exists public."CaseAssignment" (
  "caseKey" text primary key,
  "adminUserId" text references public."User"(id) on delete set null,
  "assignedAt" timestamp(3) without time zone not null default now()
);
alter table public."CaseAssignment" enable row level security;
revoke all on public."CaseAssignment" from public, anon, authenticated;

-- Last runs of the scheduled jobs, for the admin status page and failure alerts.
create table if not exists public."CronRun" (
  id text primary key default gen_random_uuid()::text,
  job text not null,
  ok boolean not null,
  detail text,
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists cron_run_job_idx on public."CronRun" (job, "createdAt" desc);
alter table public."CronRun" enable row level security;
revoke all on public."CronRun" from public, anon, authenticated;
