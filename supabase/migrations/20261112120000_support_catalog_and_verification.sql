-- Support staff may resolve catalog requests and review employment proofs.
-- Keep the separate admin-only dashboard and account tools restricted to ADMIN.
create or replace function public.can_review_verification()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public."User" u
    where u."auth_user_id" = auth.uid()
      and u.role in ('ADMIN'::public."Role", 'SUPPORT'::public."Role")
  );
$function$;
revoke all on function public.can_review_verification() from public, anon;
grant execute on function public.can_review_verification() to authenticated;

drop policy if exists admin_read_verification on public."Verification";
create policy admin_read_verification on public."Verification" for select to authenticated using (public.can_review_verification());
drop policy if exists admin_read_verification_documents on public."VerificationDocument";
create policy admin_read_verification_documents on public."VerificationDocument" for select to authenticated using (public.can_review_verification());
drop policy if exists admin_read_verification_documents on storage.objects;
create policy admin_read_verification_documents on storage.objects for select to authenticated
  using (bucket_id = 'verification-documents' and public.can_review_verification());

-- New proof notifications also reach support staff's bell.
create or replace function public.notify_support_of_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_company text;
begin
  if new.status <> 'PENDING' then return new; end if;
  select u.name, c.name into v_name, v_company
  from public."ProfessionalProfile" p
  join public."User" u on u.id = p."userId"
  left join public."EmploymentExperience" e on e.id = new."experienceId"
  left join public."Company" c on c.id = e."companyId"
  where p.id = new."professionalProfileId";
  insert into public."Notification" (id, "userId", title, body, href, "createdAt")
  select gen_random_uuid()::text, u.id, 'Novo comprovante para analisar',
    coalesce(v_name, 'Um consultor') || ' enviou um comprovante de vínculo com ' || coalesce(v_company, 'uma empresa') || '.',
    '/admin/verificacoes?id=' || new.id, now()
  from public."User" u where u.role = 'SUPPORT'::public."Role" and u.auth_user_id is not null;
  return new;
end;
$function$;
revoke all on function public.notify_support_of_verification() from public, anon, authenticated;
drop trigger if exists notify_support_of_verification on public."Verification";
create trigger notify_support_of_verification after insert on public."Verification"
  for each row execute function public.notify_support_of_verification();

create or replace function public.admin_review_verification(p_verification_id text, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reviewer_id text;
  v_profile_id text;
  v_consultant_id text;
  v_company text;
begin
  select id into v_reviewer_id from public."User"
  where auth_user_id = auth.uid() and role in ('ADMIN'::public."Role", 'SUPPORT'::public."Role");
  if v_reviewer_id is null then raise exception 'not_authorized'; end if;
  if p_decision not in ('VERIFIED', 'REJECTED') then raise exception 'invalid_decision'; end if;

  select v."professionalProfileId", pp."userId", c.name into v_profile_id, v_consultant_id, v_company
  from public."Verification" v
  join public."ProfessionalProfile" pp on pp.id = v."professionalProfileId"
  left join public."EmploymentExperience" e on e.id = v."experienceId"
  left join public."Company" c on c.id = e."companyId"
  where v.id = p_verification_id;
  if v_profile_id is null then raise exception 'verification_not_found'; end if;

  update public."Verification"
    set status = p_decision::public."VerificationStatus", "reviewerId" = v_reviewer_id, "reviewedAt" = now(), "updatedAt" = now()
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
