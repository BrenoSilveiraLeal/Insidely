create or replace function public.admin_review_verification(p_verification_id text, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id text;
  v_profile_id text;
begin
  select id into v_admin_id
  from public."User"
  where auth_user_id = (select auth.uid())
    and role = 'ADMIN'::public."Role";

  if v_admin_id is null then
    raise exception 'not_authorized';
  end if;

  if p_decision not in ('VERIFIED', 'REJECTED') then
    raise exception 'invalid_decision';
  end if;

  select "professionalProfileId" into v_profile_id
  from public."Verification"
  where id = p_verification_id;

  if v_profile_id is null then
    raise exception 'verification_not_found';
  end if;

  update public."Verification"
  set status = p_decision::public."VerificationStatus"
  where id = p_verification_id;

  update public."ProfessionalProfile"
  set "verificationStatus" = p_decision::public."VerificationStatus",
      "updatedAt" = now()
  where id = v_profile_id;
end;
$$;

revoke all on function public.admin_review_verification(text, text) from public;
grant execute on function public.admin_review_verification(text, text) to authenticated;
