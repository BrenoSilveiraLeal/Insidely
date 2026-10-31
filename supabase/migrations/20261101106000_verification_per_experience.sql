-- A consultant may have worked at several companies and prove each one: one proof per experience
-- (Verification.experienceId). Another company can be sent while one is under review; only a second
-- proof for the same experience is refused while it is pending or already verified.
-- The profile badge follows the proofs: verified when any company was verified, otherwise pending
-- when one is under review, otherwise rejected. A new proof or a rejection never removes the badge.

create or replace function public.refresh_profile_verification_status(p_profile_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public."ProfessionalProfile" p
     set "verificationStatus" = coalesce((
           select case
                    when bool_or(v.status = 'VERIFIED') then 'VERIFIED'
                    when bool_or(v.status = 'PENDING') then 'PENDING'
                    when bool_or(v.status = 'MORE_INFO_REQUIRED') then 'MORE_INFO_REQUIRED'
                    else 'REJECTED'
                  end::public."VerificationStatus"
             from public."Verification" v where v."professionalProfileId" = p.id), 'NOT_SUBMITTED'),
         "updatedAt" = now()
   where p.id = p_profile_id;
$$;
revoke all on function public.refresh_profile_verification_status(text) from public, anon, authenticated;

drop function if exists public.submit_verification(text, text, text, integer, text);

create or replace function public.submit_verification(p_storage_key text, p_original_name text, p_mime_type text, p_size_bytes integer, p_method text, p_experience_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_profile_id text; v_verification_id text; v_name text; v_company text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select p.id, u.name into v_profile_id, v_name from public."ProfessionalProfile" p join public."User" u on u.id=p."userId"
    where u.auth_user_id=auth.uid() and u.role='CONSULTANT';
  if v_profile_id is null then raise exception 'consultant_required'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') or p_size_bytes<1 or p_size_bytes>5242880
     or p_storage_key not like auth.uid()::text||'/%' or length(p_original_name)<1 or length(p_original_name)>120
     or p_method not in ('badge','timesheet','work_card','other_document','company_email','employment_document','professional_reference') then raise exception 'invalid_document'; end if;
  select c.name into v_company from public."EmploymentExperience" e join public."Company" c on c.id=e."companyId"
    where e.id=p_experience_id and e."professionalProfileId"=v_profile_id;
  if v_company is null then raise exception 'invalid_experience'; end if;
  if exists(select 1 from public."Verification" where "professionalProfileId"=v_profile_id and "experienceId"=p_experience_id and status='PENDING') then raise exception 'verification_pending'; end if;
  if exists(select 1 from public."Verification" where "professionalProfileId"=v_profile_id and "experienceId"=p_experience_id and status='VERIFIED') then raise exception 'already_verified'; end if;
  v_verification_id:=gen_random_uuid()::text;
  insert into public."Verification"(id,"professionalProfileId","experienceId",method,status,"updatedAt") values(v_verification_id,v_profile_id,p_experience_id,p_method,'PENDING',now());
  insert into public."VerificationDocument"(id,"verificationId","storageKey","originalName","mimeType","sizeBytes")
    values(gen_random_uuid()::text,v_verification_id,p_storage_key,p_original_name,p_mime_type,p_size_bytes);
  perform public.refresh_profile_verification_status(v_profile_id);
  insert into public."Notification"(id,"userId",title,body,href,"createdAt")
    select gen_random_uuid()::text, a.id, 'Novo comprovante para analisar', coalesce(v_name,'Um consultor')||' enviou um comprovante de vínculo com '||v_company||'.', '/admin/verificacoes?id='||v_verification_id, now()
    from public."User" a where a.role='ADMIN';
end $$;
revoke execute on function public.submit_verification(text,text,text,integer,text,text) from public,anon;
grant execute on function public.submit_verification(text,text,text,integer,text,text) to authenticated;

create or replace function public.admin_review_verification(p_verification_id text, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id text;
  v_profile_id text;
  v_consultant_id text;
  v_company text;
begin
  select id into v_admin_id from public."User"
  where auth_user_id = auth.uid() and role = 'ADMIN'::public."Role";
  if v_admin_id is null then raise exception 'not_authorized'; end if;
  if p_decision not in ('VERIFIED', 'REJECTED') then raise exception 'invalid_decision'; end if;

  select v."professionalProfileId", pp."userId", c.name into v_profile_id, v_consultant_id, v_company
  from public."Verification" v join public."ProfessionalProfile" pp on pp.id = v."professionalProfileId"
    left join public."EmploymentExperience" e on e.id = v."experienceId"
    left join public."Company" c on c.id = e."companyId"
  where v.id = p_verification_id;
  if v_profile_id is null then raise exception 'verification_not_found'; end if;

  update public."Verification"
    set status = p_decision::public."VerificationStatus", "reviewerId" = v_admin_id, "reviewedAt" = now(), "updatedAt" = now()
    where id = p_verification_id;
  perform public.refresh_profile_verification_status(v_profile_id);

  insert into public."Notification" (id, "userId", title, body, href, "createdAt")
  values (gen_random_uuid()::text, v_consultant_id,
    case when p_decision = 'VERIFIED' then 'Experiência verificada' else 'Comprovante não aprovado' end,
    case when p_decision = 'VERIFIED' then 'Seu comprovante' || coalesce(' de ' || v_company, '') || ' foi aprovado e o selo de experiência verificada já aparece no seu perfil.'
         else 'Não foi possível validar o comprovante' || coalesce(' de ' || v_company, '') || '. Você pode enviar outro documento pelo seu perfil.' end,
    '/consultor/perfil#verificacao', now());
end;
$function$;

revoke all on function public.admin_review_verification(text, text) from public, anon;
grant execute on function public.admin_review_verification(text, text) to authenticated;
