-- Expose only the public projection columns required by the invoker view.
revoke select on table public."ProfessionalProfile" from anon, authenticated;
grant select (id, "userId", headline, location, "workMode", "price30Cents", "privacyMode", pseudonym, "verificationStatus", "publicSurname", bio, region, seniority, "yearsExperience", "price60Cents", "responseHours", topics, boundaries, "isActive") on public."ProfessionalProfile" to anon, authenticated;

create or replace function public.is_public_professional_user(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (select 1 from public."ProfessionalProfile" p where p."userId" = p_user_id and p."isActive" = true)
$function$;
revoke all on function public.is_public_professional_user(text) from public;
grant execute on function public.is_public_professional_user(text) to anon, authenticated;

drop policy if exists professional_profile_public_select on public."ProfessionalProfile";
create policy professional_profile_public_select on public."ProfessionalProfile"
for select to anon, authenticated using ("isActive" = true);

revoke select on table public."User" from anon, authenticated;
grant select (id, name, image) on public."User" to anon;
grant select (id, name, image, email, role, "onboardingCompleted", "auth_user_id") on public."User" to authenticated;

drop policy if exists user_public_profile_select on public."User";
create policy user_public_profile_select on public."User"
for select to anon using (public.is_public_professional_user(id));
