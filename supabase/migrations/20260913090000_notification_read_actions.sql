create or replace function public.current_app_user_id()
returns text language sql security definer set search_path = '' as $$
  select u.id from public."User" u where u."auth_user_id" = (select auth.uid()) limit 1
$$;

revoke all on function public.current_app_user_id() from public, anon;
grant execute on function public.current_app_user_id() to authenticated;

grant update on public."Notification" to authenticated;

drop policy if exists notification_owner_update on public."Notification";
create policy notification_owner_update on public."Notification" for update to authenticated using (
  "userId" = public.current_app_user_id()
) with check (
  "userId" = public.current_app_user_id()
);
