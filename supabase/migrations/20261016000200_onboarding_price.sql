-- Consultants finished onboarding with price 0, so new profiles were listed as "R$ 0,00 / 30 min".
-- Onboarding now collects the 30-minute price (minimum R$ 10, default R$ 50); 60 minutes defaults to
-- 1.8x and can be edited later in the profile.
create or replace function public.complete_onboarding(p_role text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user public."User";
  v_profile_id text;
  v_company_id text := nullif(trim(p_payload->>'companyId'),'');
  v_profession_id text := nullif(trim(p_payload->>'professionId'),'');
  v_years integer;
  v_bio text := trim(coalesce(p_payload->>'bio',''));
  v_price30 integer;
begin
  if auth.uid() is null or p_role not in ('USER','CONSULTANT') then raise exception 'unauthorized'; end if;
  select * into v_user from public."User" where auth_user_id=auth.uid() for update;
  if v_user.id is null then raise exception 'profile_not_found'; end if;
  if v_user."onboardingCompleted" then return; end if;

  if p_role='CONSULTANT' then
    v_years := greatest(0,least(60,coalesce(nullif(p_payload->>'yearsExperience','')::integer,0)));
    v_price30 := greatest(1000, least(100000, round(coalesce(nullif(replace(trim(coalesce(p_payload->>'price30','')),',','.'),'')::numeric, 50) * 100)::integer));
    if length(trim(coalesce(p_payload->>'headline',''))) < 3 or length(v_bio) < 30
       or length(trim(coalesce(p_payload->>'location',''))) < 2
       or length(trim(coalesce(p_payload->>'title',''))) < 2
       or not exists(select 1 from public."Company" where id=v_company_id)
       or not exists(select 1 from public."Profession" where id=v_profession_id) then
      raise exception 'invalid_onboarding_data';
    end if;
    v_profile_id := gen_random_uuid()::text;
    insert into public."ProfessionalProfile"(id,"userId",headline,bio,location,region,"workMode",seniority,"yearsExperience","price30Cents","price60Cents","avatarSeed",topics,boundaries,"updatedAt")
    values(v_profile_id,v_user.id,left(trim(p_payload->>'headline'),160),left(v_bio,2000),left(trim(p_payload->>'location'),160),'Brasil','REMOTE','MID',v_years,v_price30,round(v_price30 * 1.8)::integer,auth.uid()::text,'{}','{}',now());
    insert into public."EmploymentExperience"(id,"professionalProfileId","companyId","professionId",title,area,"isCurrent","startedAt",summary)
    values(gen_random_uuid()::text,v_profile_id,v_company_id,v_profession_id,left(trim(p_payload->>'title'),160),'Profissional',true,(current_date - make_interval(years=>v_years))::timestamp,left(v_bio,1000));
    insert into public."PrivacySettings"(id,"professionalProfileId","updatedAt") values(gen_random_uuid()::text,v_profile_id,now());
  end if;
  update public."User" set role=p_role::public."Role", "onboardingCompleted"=true, "updatedAt"=now() where id=v_user.id;
end $function$;


revoke all on function public.complete_onboarding(text,jsonb) from public, anon;
grant execute on function public.complete_onboarding(text,jsonb) to authenticated;

update public."ProfessionalProfile" set "price30Cents" = 5000, "updatedAt" = now() where "price30Cents" = 0;
update public."ProfessionalProfile" set "price60Cents" = 9000, "updatedAt" = now() where "price60Cents" = 0;
