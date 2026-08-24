create or replace function public.sync_social_profile(p_name text, p_image text)
returns table(role text, "onboardingCompleted" boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select * from public.sync_google_profile(p_name, p_image);
end;
$$;

revoke all on function public.sync_social_profile(text, text) from public, anon;
grant execute on function public.sync_social_profile(text, text) to authenticated;
