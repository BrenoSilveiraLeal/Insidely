-- Limits how often the app sends account e-mails (sign-up, recovery, e-mail change) per address and per IP,
-- so nobody can flood someone else's inbox through the public forms. Only the server (service role) uses it.
create table if not exists public."AuthEmailThrottle" (
  key text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public."AuthEmailThrottle" enable row level security;
revoke all on public."AuthEmailThrottle" from anon, authenticated;

-- Atomically counts one attempt for p_key and says whether it is still within p_limit for the window.
create or replace function public.consume_auth_email_quota(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempts integer;
begin
  insert into public."AuthEmailThrottle" as t (key, window_start, attempts)
  values (p_key, now(), 1)
  on conflict (key) do update
    set attempts = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.attempts + 1 end,
        window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end
  returning attempts into v_attempts;
  -- Old rows are useless after a day; trim a few on each call instead of needing a cron job.
  delete from public."AuthEmailThrottle" where key in (select key from public."AuthEmailThrottle" where window_start < now() - interval '1 day' limit 50);
  return v_attempts <= p_limit;
end;
$function$;

revoke all on function public.consume_auth_email_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_email_quota(text, integer, integer) to service_role;
