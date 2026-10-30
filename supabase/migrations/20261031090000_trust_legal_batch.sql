-- Batch: review reports and replies, access log (Marco Civil), accepted terms version.

-- Reviews that the filter did not catch can be reported; an admin removes the review if it breaks
-- the rules (the report row keeps what it said).
create table if not exists public."ReviewReport" (
  id text primary key default gen_random_uuid()::text,
  "reviewId" text references public."Review"(id) on delete set null,
  "reporterId" text not null references public."User"(id) on delete cascade,
  reason text not null check (length(reason) between 10 and 1000),
  "reviewComment" text,
  "reviewRating" integer,
  "professionalProfileId" text,
  status text not null default 'OPEN' check (status in ('OPEN', 'REMOVED', 'KEPT')),
  "createdAt" timestamp(3) without time zone not null default now(),
  "resolvedAt" timestamp(3) without time zone
);
alter table public."ReviewReport" enable row level security;
revoke all on public."ReviewReport" from public, anon, authenticated;

-- One public reply from the consultant per review.
create table if not exists public."ReviewReply" (
  "reviewId" text primary key references public."Review"(id) on delete cascade,
  "consultantUserId" text not null references public."User"(id) on delete cascade,
  body text not null check (length(body) between 2 and 1000),
  "createdAt" timestamp(3) without time zone not null default now()
);
alter table public."ReviewReply" enable row level security;
revoke all on public."ReviewReply" from public, anon, authenticated;

-- Marco Civil da Internet, art. 15: application access records (date, time and IP) are kept for
-- six months. Written on every sign-in; older rows are purged by the daily job.
create table if not exists public."AccessLog" (
  id text primary key default gen_random_uuid()::text,
  "userId" text references public."User"(id) on delete set null,
  "authUserId" uuid,
  ip text,
  "userAgent" text,
  method text not null,
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists access_log_created_idx on public."AccessLog" ("createdAt");
create index if not exists access_log_user_idx on public."AccessLog" ("userId", "createdAt" desc);
alter table public."AccessLog" enable row level security;
revoke all on public."AccessLog" from public, anon, authenticated;

-- Which version of the Terms each account accepted; a new version asks for a new acceptance.
alter table public."User" add column if not exists "termsVersion" text;
alter table public."User" add column if not exists "termsAcceptedAt" timestamp(3) without time zone;
