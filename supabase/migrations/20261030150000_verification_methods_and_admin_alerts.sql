-- Proof of employment: the consultant picks what the photo or PDF is (badge, time sheet or payslip,
-- digital work card or another document) and every admin is notified with a link to review it.
create or replace function public.submit_verification(p_storage_key text,p_original_name text,p_mime_type text,p_size_bytes integer,p_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_profile_id text; v_verification_id text; v_name text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select p.id, u.name into v_profile_id, v_name from public."ProfessionalProfile" p join public."User" u on u.id=p."userId"
    where u.auth_user_id=auth.uid() and u.role='CONSULTANT';
  if v_profile_id is null then raise exception 'consultant_required'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') or p_size_bytes<1 or p_size_bytes>5242880
     or p_storage_key not like auth.uid()::text||'/%' or length(p_original_name)<1 or length(p_original_name)>120
     or p_method not in ('badge','timesheet','work_card','other_document','company_email','employment_document','professional_reference') then raise exception 'invalid_document'; end if;
  if exists(select 1 from public."Verification" where "professionalProfileId"=v_profile_id and status='PENDING') then raise exception 'verification_pending'; end if;
  v_verification_id:=gen_random_uuid()::text;
  insert into public."Verification"(id,"professionalProfileId",method,status,"updatedAt") values(v_verification_id,v_profile_id,p_method,'PENDING',now());
  insert into public."VerificationDocument"(id,"verificationId","storageKey","originalName","mimeType","sizeBytes")
    values(gen_random_uuid()::text,v_verification_id,p_storage_key,p_original_name,p_mime_type,p_size_bytes);
  update public."ProfessionalProfile" set "verificationStatus"='PENDING',"updatedAt"=now() where id=v_profile_id;
  insert into public."Notification"(id,"userId",title,body,href,"createdAt")
    select gen_random_uuid()::text, a.id, 'Novo comprovante para analisar', coalesce(v_name,'Um consultor')||' enviou um comprovante de vínculo com a empresa.', '/admin/verificacoes?id='||v_verification_id, now()
    from public."User" a where a.role='ADMIN';
end $$;
revoke execute on function public.submit_verification(text,text,text,integer,text) from public,anon;
grant execute on function public.submit_verification(text,text,text,integer,text) to authenticated;
