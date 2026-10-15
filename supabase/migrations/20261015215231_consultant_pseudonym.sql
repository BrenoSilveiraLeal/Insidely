-- Permite nome público fictício e preserva os dados privados do perfil no formulário.
create or replace function public.update_professional_profile(p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $function$
declare
  v_profile_id text;
  v_experiences jsonb := coalesce(p_payload->'experiences', '[]'::jsonb);
  v_item jsonb;
  v_index integer := 0;
  v_started timestamp;
  v_ended timestamp;
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  select pp.id into v_profile_id
  from public."User" u join public."ProfessionalProfile" pp on pp."userId" = u.id
  where u."auth_user_id" = auth.uid() and u.role = 'CONSULTANT'::public."Role";
  if v_profile_id is null then raise exception 'profile_not_found'; end if;

    if nullif(trim(p_payload->>'pseudonym'), '') ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}' or length(regexp_replace(coalesce(p_payload->>'pseudonym', ''), '[^0-9]', '', 'g')) >= 10 then raise exception 'invalid_pseudonym'; end if;

  update public."ProfessionalProfile" set
    headline = coalesce(nullif(trim(p_payload->>'headline'), ''), headline),
    bio = coalesce(nullif(trim(p_payload->>'bio'), ''), bio),
    location = coalesce(nullif(trim(p_payload->>'location'), ''), location),
    region = coalesce(nullif(trim(p_payload->>'region'), ''), region),
    "publicSurname" = nullif(trim(p_payload->>'publicSurname'), ''),
    pseudonym = nullif(left(trim(p_payload->>'pseudonym'), 40), ''),
    "ageRange" = nullif(p_payload->>'ageRange', ''),
    "workMode" = coalesce(p_payload->>'workMode', "workMode"::text)::public."WorkMode",
    seniority = coalesce(p_payload->>'seniority', seniority::text)::public."Seniority",
    "yearsExperience" = coalesce(nullif(p_payload->>'yearsExperience','')::integer, "yearsExperience"),
    "price30Cents" = coalesce(nullif(p_payload->>'price30Cents','')::integer, "price30Cents"),
    "price60Cents" = coalesce(nullif(p_payload->>'price60Cents','')::integer, "price60Cents"),
    "responseHours" = coalesce(nullif(p_payload->>'responseHours','')::integer, "responseHours"),
    "pixKey" = nullif(p_payload->>'pixKey',''),
    topics = string_to_array(nullif(p_payload->>'topics',''), ', '),
    boundaries = string_to_array(nullif(p_payload->>'boundaries',''), ', '),
    "updatedAt" = now()
  where id = v_profile_id;

  if jsonb_typeof(v_experiences) <> 'array' or jsonb_array_length(v_experiences) > 20 then
    raise exception 'invalid_experiences';
  end if;
  delete from public."EmploymentExperience" where "professionalProfileId" = v_profile_id;
  for v_item in select value from jsonb_array_elements(v_experiences)
  loop
    v_started := nullif(v_item->>'startedAt','')::timestamp;
    v_ended := nullif(v_item->>'endedAt','')::timestamp;
    if v_started is null or v_ended is not null and v_ended < v_started then raise exception 'invalid_experience_dates'; end if;
    insert into public."EmploymentExperience" (
      id, "professionalProfileId", "companyId", "professionId", title, area, "isCurrent", "startedAt", "endedAt", summary, "createdAt"
    ) values (
      coalesce(nullif(v_item->>'id',''), extensions.gen_random_uuid()::text), v_profile_id,
      nullif(v_item->>'companyId',''), nullif(v_item->>'professionId',''),
      left(coalesce(v_item->>'title',''), 160), left(coalesce(v_item->>'area',''), 160),
      coalesce((v_item->>'isCurrent')::boolean, false), v_started, v_ended,
      left(coalesce(v_item->>'summary',''), 2000), now()
    );
    v_index := v_index + 1;
  end loop;
end;
$function$;

create or replace function public.get_consultant_summary(p_user_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_profile public."ProfessionalProfile"; v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public."User" u where u.id=p_user_id and u."auth_user_id"=v_uid and u.role='CONSULTANT'::public."Role") then raise exception 'not_authorized'; end if;
  select p.* into v_profile from public."ProfessionalProfile" p where p."userId"=p_user_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'id',v_profile.id,'userId',v_profile."userId",'headline',v_profile.headline,'bio',v_profile.bio,'publicSurname',v_profile."publicSurname",'pseudonym',v_profile.pseudonym,'pixKey',v_profile."pixKey",
    'ageRange',v_profile."ageRange",'location',v_profile.location,'region',v_profile.region,'workMode',v_profile."workMode",'seniority',v_profile.seniority,
    'yearsExperience',v_profile."yearsExperience",'price30Cents',v_profile."price30Cents",'price60Cents',v_profile."price60Cents",'responseHours',v_profile."responseHours",
    'privacyMode',v_profile."privacyMode",'topics',v_profile.topics,'boundaries',v_profile.boundaries,'verificationStatus',v_profile."verificationStatus",
    'user',(select to_jsonb(u)-'passwordHash'-'twoFactorSecret'-'twoFactorRecoveryCodes' from public."User" u where u.id=p_user_id),
    'privacy',(select to_jsonb(ps) from public."PrivacySettings" ps where ps."professionalProfileId"=v_profile.id),
    'experiences',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('company',(select jsonb_build_object('name',c.name) from public."Company" c where c.id=e."companyId"),'profession',(select jsonb_build_object('name',p.name) from public."Profession" p where p.id=e."professionId")) order by e."isCurrent" desc,e."startedAt" desc) from public."EmploymentExperience" e where e."professionalProfileId"=v_profile.id),'[]'::jsonb),
    'availability',coalesce((select jsonb_agg(to_jsonb(a) order by a."startsAt") from public."Availability" a where a."professionalProfileId"=v_profile.id and a."endsAt">now()),'[]'::jsonb),
    'profileViews',coalesce((select jsonb_agg(jsonb_build_object('id',v.id)) from public."ProfileView" v where v."professionalProfileId"=v_profile.id),'[]'::jsonb),
    'favorites',coalesce((select jsonb_agg(jsonb_build_object('id',f.id)) from public."Favorite" f where f."professionalProfileId"=v_profile.id),'[]'::jsonb),
    'bookingCount',(select count(*) from public."Booking" b where b."professionalProfileId"=v_profile.id)
  );
end;
$function$;

revoke all on function public.update_professional_profile(jsonb), public.get_consultant_summary(text) from public, anon;
grant execute on function public.update_professional_profile(jsonb), public.get_consultant_summary(text) to authenticated;
