create or replace function public.complete_booking(p_booking_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.confirm_booking(p_booking_id);
$$;

revoke all on function public.complete_booking(text) from public, anon;
grant execute on function public.complete_booking(text) to authenticated;
