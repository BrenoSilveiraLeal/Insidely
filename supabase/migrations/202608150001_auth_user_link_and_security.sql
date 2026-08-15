-- Additive migration: preserves existing tables and rows.
alter table if exists public."User"
  add column if not exists auth_user_id uuid;

create unique index if not exists user_auth_user_id_key
  on public."User" (auth_user_id)
  where auth_user_id is not null;

comment on column public."User".auth_user_id is
  'Supabase auth.users.id; populated gradually during the auth migration.';

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select role::text
  from public."User"
  where auth_user_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

-- Defense in depth. Specific policies are added only after each access path is verified.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
