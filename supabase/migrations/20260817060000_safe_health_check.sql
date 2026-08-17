create or replace function public.health_check()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select jsonb_build_object('ok', true) $$;

revoke execute on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;
