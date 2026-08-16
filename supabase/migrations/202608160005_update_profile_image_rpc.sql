create or replace function public.update_profile_image(p_image text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public."User"
  set image = p_image, "updatedAt" = now()
  where auth_user_id = (select auth.uid());
  if not found then raise exception 'user_not_found'; end if;
end;
$$;
revoke all on function public.update_profile_image(text) from public;
grant execute on function public.update_profile_image(text) to authenticated;
