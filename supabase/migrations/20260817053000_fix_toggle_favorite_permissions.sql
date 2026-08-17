-- Keep toggle_favorite as SECURITY INVOKER. Grant only the relations and
-- columns required by the RPC, while RLS continues to enforce ownership.
grant select, insert, delete on public."Favorite" to authenticated;
grant select(id, "isActive") on public."ProfessionalProfile" to authenticated;

drop policy if exists professional_active_lookup on public."ProfessionalProfile";
create policy professional_active_lookup
on public."ProfessionalProfile"
for select
to authenticated
using ("isActive" = true);

-- Recreate explicitly so ownership is checked for reads and mutations.
drop policy if exists favorite_owner_access on public."Favorite";
create policy favorite_owner_access
on public."Favorite"
for all
to authenticated
using (
  "userId" = (
    select u.id from public."User" u
    where u.auth_user_id = (select auth.uid())
  )
)
with check (
  "userId" = (
    select u.id from public."User" u
    where u.auth_user_id = (select auth.uid())
  )
);

revoke execute on function public.toggle_favorite(text) from public, anon;
grant execute on function public.toggle_favorite(text) to authenticated;
