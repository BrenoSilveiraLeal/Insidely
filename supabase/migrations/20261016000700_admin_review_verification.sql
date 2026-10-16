-- The admin "Aprovar"/"Rejeitar" buttons call admin_review_verification, but its original migration
-- (202608160004) was never applied to the remote database, so every review failed. Recreated with a
-- locked search_path, reviewer/date tracking and an in-app notice to the consultant.
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
begin
  select id into v_admin_id from public."User"
  where auth_user_id = auth.uid() and role = 'ADMIN'::public."Role";
  if v_admin_id is null then raise exception 'not_authorized'; end if;
  if p_decision not in ('VERIFIED', 'REJECTED') then raise exception 'invalid_decision'; end if;

  select v."professionalProfileId", pp."userId" into v_profile_id, v_consultant_id
  from public."Verification" v join public."ProfessionalProfile" pp on pp.id = v."professionalProfileId"
  where v.id = p_verification_id;
  if v_profile_id is null then raise exception 'verification_not_found'; end if;

  update public."Verification"
    set status = p_decision::public."VerificationStatus", "reviewerId" = v_admin_id, "reviewedAt" = now(), "updatedAt" = now()
    where id = p_verification_id;
  update public."ProfessionalProfile"
    set "verificationStatus" = p_decision::public."VerificationStatus", "updatedAt" = now()
    where id = v_profile_id;

  insert into public."Notification" (id, "userId", title, body, href, "createdAt")
  values (gen_random_uuid()::text, v_consultant_id,
    case when p_decision = 'VERIFIED' then 'Experiência verificada' else 'Comprovante não aprovado' end,
    case when p_decision = 'VERIFIED' then 'Seu comprovante foi aprovado e o selo de experiência verificada já aparece no seu perfil.'
         else 'Não foi possível validar o comprovante enviado. Você pode enviar outro documento pelo seu perfil.' end,
    '/consultor/perfil', now());
end;
$function$;

revoke all on function public.admin_review_verification(text, text) from public, anon;
grant execute on function public.admin_review_verification(text, text) to authenticated;
