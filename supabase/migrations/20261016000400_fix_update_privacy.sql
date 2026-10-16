-- update_privacy assigned "showFullHistory" twice, so Postgres rejected every save of the privacy page
-- ("multiple assignments to same column").
create or replace function public.update_privacy(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_profile_id text;
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  select pp.id into v_profile_id from public."ProfessionalProfile" pp join public."User" u on u.id = pp."userId"
  where u."auth_user_id" = auth.uid() and u.role = 'CONSULTANT'::public."Role";
  if v_profile_id is null then raise exception 'profile_not_found'; end if;
  update public."PrivacySettings" set
    "showRealName" = coalesce((p_payload->>'showRealName')::boolean, "showRealName"),
    "showSurname" = coalesce((p_payload->>'showSurname')::boolean, "showSurname"),
    "showPhoto" = coalesce((p_payload->>'showPhoto')::boolean, "showPhoto"),
    "showCurrentCompany" = coalesce((p_payload->>'showCurrentCompany')::boolean, "showCurrentCompany"),
    "showCity" = coalesce((p_payload->>'showCity')::boolean, "showCity"),
    "showExactDates" = coalesce((p_payload->>'showExactDates')::boolean, "showExactDates"),
    "showFullHistory" = coalesce((p_payload->>'showFullHistory')::boolean, "showFullHistory"),
    "showAgeRange" = coalesce((p_payload->>'showAgeRange')::boolean, "showAgeRange"),
    "searchableByCompany" = coalesce((p_payload->>'searchableByCompany')::boolean, "searchableByCompany"),
    "searchableByProfession" = coalesce((p_payload->>'searchableByProfession')::boolean, "searchableByProfession"),
    "updatedAt" = now()
  where "professionalProfileId" = v_profile_id;
  if not found then raise exception 'privacy_settings_not_found'; end if;
end;
$function$;


revoke all on function public.update_privacy(jsonb) from public, anon;
grant execute on function public.update_privacy(jsonb) to authenticated;
