-- Support requests and reports become threads: the team and the person who opened the case
-- exchange messages on the same case until either side closes it. Server-side access only
-- (service role, after the app checks who is reading), so no policies for anon/authenticated.
create table if not exists public."ReportMessage" (
  id text primary key default gen_random_uuid()::text,
  "reportId" text not null references public."Report"(id) on delete cascade,
  "authorId" text references public."User"(id) on delete set null,
  "fromStaff" boolean not null default false,
  body text not null check (length(trim(body)) between 1 and 4000),
  "createdAt" timestamptz not null default now()
);
create index if not exists "ReportMessage_reportId_createdAt_idx" on public."ReportMessage" ("reportId", "createdAt");
create index if not exists "ReportMessage_authorId_idx" on public."ReportMessage" ("authorId");
alter table public."ReportMessage" enable row level security;
revoke all on public."ReportMessage" from public, anon, authenticated;

-- Earlier single replies (Report.resolution) become the first team message of their thread.
insert into public."ReportMessage" ("reportId", "fromStaff", body, "createdAt")
select id, true, resolution, "updatedAt" from public."Report" r
where resolution is not null and length(trim(resolution)) > 0
  and not exists (select 1 from public."ReportMessage" m where m."reportId" = r.id);
