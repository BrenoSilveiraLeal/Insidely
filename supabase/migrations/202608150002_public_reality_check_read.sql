-- Public Reality Check cards are readable without exposing write access.
alter table if exists public."RealityCheck" enable row level security;
grant select on table public."RealityCheck" to anon, authenticated;

drop policy if exists "Public can read reality checks" on public."RealityCheck";
create policy "Public can read reality checks"
  on public."RealityCheck"
  for select
  to anon, authenticated
  using (true);

-- The nested profession relation is selected by the public Reality Check page.
alter table if exists public."Profession" enable row level security;
grant select on table public."Profession" to anon, authenticated;

drop policy if exists "Public can read professions" on public."Profession";
create policy "Public can read professions"
  on public."Profession"
  for select
  to anon, authenticated
  using (true);
