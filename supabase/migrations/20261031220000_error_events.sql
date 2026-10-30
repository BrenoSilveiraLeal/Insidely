-- Server errors captured by src/instrumentation.ts (onRequestError), listed on /admin/status.
-- Kept 30 days. No headers or bodies are stored: they carry cookies and personal data.
create table if not exists public."ErrorEvent" (
  id text primary key default gen_random_uuid()::text,
  path text,
  "routeType" text,
  message text,
  digest text,
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists error_event_created_idx on public."ErrorEvent" ("createdAt" desc);
alter table public."ErrorEvent" enable row level security;
revoke all on public."ErrorEvent" from public, anon, authenticated;
