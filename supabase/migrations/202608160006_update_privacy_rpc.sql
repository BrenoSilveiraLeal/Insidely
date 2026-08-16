create or replace function public.update_privacy(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id text;
begin
  select pp.id into v_profile_id
  from public."ProfessionalProfile" pp
  join public."User" u on u.id = pp."userId"
  where u.auth_user_id = (select auth.uid())
    and u.role = 'CONSULTANT'::public."Role";

  if v_profile_id is null then raise exception 'profile_not_found'; end if;

  update public."PrivacySettings"
  set "showRealName" = coalesce((p_payload->>'showRealName')::boolean, "showRealName"),
      "showSurname" = coalesce((p_payload->>'showSurname')::boolean, "showSurname"),
      "showPhoto" = coalesce((p_payload->>'showPhoto')::boolean, "showPhoto"),
      "showCurrentCompany" = coalesce((p_payload->>'showCurrentCompany')::boolean, "showCurrentCompany"),
      "showCity" = coalesce((p_payload->>'showCity')::boolean, "showCity"),
      "showExactDates" = coalesce((p_payload->>'showExactDates')::boolean, "showExactDates"),
      "showFullHistory" = coalesce((p_payload->>'showFullHistory')::boolean, "showFullHistory"),
      "searchableByCompany" = coalesce((p_payload->>'searchableByCompany')::boolean, "searchableByCompany"),
      "searchableByProfession" = coalesce((p_payload->>'searchableByProfession')::boolean, "searchableByProfession"),
      "updatedAt" = now()
  where "professionalProfileId" = v_profile_id;

  if not found then raise exception 'privacy_settings_not_found'; end if;
end;
$$;

revoke all on function public.update_privacy(jsonb) from public;
grant execute on function public.update_privacy(jsonb) to authenticated;
