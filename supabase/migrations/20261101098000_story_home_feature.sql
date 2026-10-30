-- Approved "Decidi!" stories show on the consultant's profile; up to three of them are also
-- picked by the team for the home page carousel (featuredAt set = on the home page).
alter table public."DecisionStory" add column if not exists "featuredAt" timestamptz;
create index if not exists "DecisionStory_featuredAt_idx" on public."DecisionStory" ("featuredAt") where "featuredAt" is not null;

-- Stories already approved start on the home page, as they are today (at most three).
update public."DecisionStory" set "featuredAt" = "createdAt"
where "bookingId" in (
  select "bookingId" from public."DecisionStory"
  where status = 'APPROVED' and "allowPublish" and "featuredAt" is null
  order by "createdAt" desc limit 3
);
