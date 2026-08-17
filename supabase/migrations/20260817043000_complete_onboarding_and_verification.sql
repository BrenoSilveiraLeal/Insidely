create or replace function public.complete_onboarding(p_role text, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user public."User";
  v_profile_id text;
  v_company_id text := nullif(trim(p_payload->>'companyId'),'');
  v_profession_id text := nullif(trim(p_payload->>'professionId'),'');
  v_years integer;
  v_bio text := trim(coalesce(p_payload->>'bio',''));
begin
  if auth.uid() is null or p_role not in ('USER','CONSULTANT') then raise exception 'unauthorized'; end if;
  select * into v_user from public."User" where auth_user_id=auth.uid() for update;
  if v_user.id is null then raise exception 'profile_not_found'; end if;
  if v_user."onboardingCompleted" then return; end if;

  if p_role='CONSULTANT' then
    v_years := greatest(0,least(60,coalesce(nullif(p_payload->>'yearsExperience','')::integer,0)));
    if length(trim(coalesce(p_payload->>'headline',''))) < 3 or length(v_bio) < 30
       or length(trim(coalesce(p_payload->>'location',''))) < 2
       or length(trim(coalesce(p_payload->>'title',''))) < 2
       or not exists(select 1 from public."Company" where id=v_company_id)
       or not exists(select 1 from public."Profession" where id=v_profession_id) then
      raise exception 'invalid_onboarding_data';
    end if;
    v_profile_id := gen_random_uuid()::text;
    insert into public."ProfessionalProfile"(id,"userId",headline,bio,location,region,"workMode",seniority,"yearsExperience","price30Cents","price60Cents","avatarSeed",topics,boundaries,"updatedAt")
    values(v_profile_id,v_user.id,left(trim(p_payload->>'headline'),160),left(v_bio,2000),left(trim(p_payload->>'location'),160),'Brasil','REMOTE','MID',v_years,0,0,auth.uid()::text,'{}','{}',now());
    insert into public."EmploymentExperience"(id,"professionalProfileId","companyId","professionId",title,area,"isCurrent","startedAt",summary)
    values(gen_random_uuid()::text,v_profile_id,v_company_id,v_profession_id,left(trim(p_payload->>'title'),160),'Profissional',true,(current_date - make_interval(years=>v_years))::timestamp,left(v_bio,1000));
    insert into public."PrivacySettings"(id,"professionalProfileId","updatedAt") values(gen_random_uuid()::text,v_profile_id,now());
  end if;
  update public."User" set role=p_role::public."Role", "onboardingCompleted"=true, "updatedAt"=now() where id=v_user.id;
end $$;

create or replace function public.submit_verification(p_storage_key text,p_original_name text,p_mime_type text,p_size_bytes integer,p_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_profile_id text; v_verification_id text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select p.id into v_profile_id from public."ProfessionalProfile" p join public."User" u on u.id=p."userId"
    where u.auth_user_id=auth.uid() and u.role='CONSULTANT';
  if v_profile_id is null then raise exception 'consultant_required'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') or p_size_bytes<1 or p_size_bytes>5242880
     or p_storage_key not like auth.uid()::text||'/%' or length(p_original_name)<1 or length(p_original_name)>120
     or p_method not in ('company_email','employment_document','professional_reference') then raise exception 'invalid_document'; end if;
  if exists(select 1 from public."Verification" where "professionalProfileId"=v_profile_id and status='PENDING') then raise exception 'verification_pending'; end if;
  v_verification_id:=gen_random_uuid()::text;
  insert into public."Verification"(id,"professionalProfileId",method,status,"updatedAt") values(v_verification_id,v_profile_id,p_method,'PENDING',now());
  insert into public."VerificationDocument"(id,"verificationId","storageKey","originalName","mimeType","sizeBytes")
    values(gen_random_uuid()::text,v_verification_id,p_storage_key,p_original_name,p_mime_type,p_size_bytes);
  update public."ProfessionalProfile" set "verificationStatus"='PENDING',"updatedAt"=now() where id=v_profile_id;
end $$;

revoke execute on function public.complete_onboarding(text,jsonb), public.submit_verification(text,text,text,integer,text), public.sync_social_profile(text,text) from public,anon;
grant execute on function public.complete_onboarding(text,jsonb), public.submit_verification(text,text,text,integer,text), public.sync_social_profile(text,text) to authenticated;
