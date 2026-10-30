-- create_support_report is callable straight from the REST API, so a signed-in account could open
-- thousands of tickets (each one notifies every admin). Cap reports at 10 per account per hour.
create or replace function public.limit_report_rate()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new."reporterId" is not null and (
    select count(*) from public."Report" where "reporterId" = new."reporterId" and "createdAt" > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'rate_limited';
  end if;
  return new;
end $$;

revoke all on function public.limit_report_rate() from public, anon, authenticated;

drop trigger if exists limit_report_rate on public."Report";
create trigger limit_report_rate before insert on public."Report" for each row execute function public.limit_report_rate();
