create or replace function public.update_professional_profile(p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_user_id text; v_profile_id text; v_experience_id text;
begin
  select u.id, pp.id into v_user_id, v_profile_id
  from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id
  where u.auth_user_id=(select auth.uid()) and u.role='CONSULTANT'::public."Role";
  if v_profile_id is null then raise exception 'profile_not_found'; end if;
  update public."ProfessionalProfile" set headline=coalesce(p_payload->>'headline',headline),bio=coalesce(p_payload->>'bio',bio),location=coalesce(p_payload->>'location',location),region=coalesce(p_payload->>'region',region),"workMode"=coalesce(p_payload->>'workMode',"workMode"::text)::public."WorkMode",seniority=coalesce(p_payload->>'seniority',seniority::text)::public."Seniority","yearsExperience"=coalesce(nullif(p_payload->>'yearsExperience','')::integer,"yearsExperience"),"price30Cents"=coalesce(nullif(p_payload->>'price30Cents','')::integer,"price30Cents"),"price60Cents"=coalesce(nullif(p_payload->>'price60Cents','')::integer,"price60Cents"),"responseHours"=coalesce(nullif(p_payload->>'responseHours','')::integer,"responseHours"),"pixKey"=nullif(p_payload->>'pixKey',''),topics=string_to_array(nullif(p_payload->>'topics',''),', '),boundaries=string_to_array(nullif(p_payload->>'boundaries',''),', '),"updatedAt"=now() where id=v_profile_id;
  select id into v_experience_id from public."EmploymentExperience" where "professionalProfileId"=v_profile_id order by "createdAt" limit 1;
  if v_experience_id is null then
    insert into public."EmploymentExperience" (id,"professionalProfileId","companyId","professionId",title,"isCurrent","createdAt") values(gen_random_uuid()::text,v_profile_id,p_payload->>'companyId',p_payload->>'professionId',coalesce(p_payload->>'title',''),true,now());
  else
    update public."EmploymentExperience" set "companyId"=coalesce(nullif(p_payload->>'companyId',''),"companyId"),"professionId"=coalesce(nullif(p_payload->>'professionId',''),"professionId"),title=coalesce(nullif(p_payload->>'title',''),title) where id=v_experience_id;
  end if;
end; $$;
revoke all on function public.update_professional_profile(jsonb) from public;
grant execute on function public.update_professional_profile(jsonb) to authenticated;
