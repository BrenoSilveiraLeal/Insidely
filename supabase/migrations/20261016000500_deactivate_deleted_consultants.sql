-- Account deletion (Edge Function delete-account) anonymizes the User row but left the consultant's
-- ProfessionalProfile active, so "Conta excluída" kept showing up in search with open slots.
-- Deactivate the profile and drop its free slots whenever a user is anonymized.
create or replace function public.deactivate_profile_of_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.auth_user_id is null and new.email like 'deleted+%@invalid.insidely' then
    update public."ProfessionalProfile" set "isActive" = false, "updatedAt" = now() where "userId" = new.id and "isActive";
    delete from public."Availability" a
      using public."ProfessionalProfile" pp
      where pp.id = a."professionalProfileId" and pp."userId" = new.id and a."isBooked" = false;
  end if;
  return new;
end;
$function$;

revoke all on function public.deactivate_profile_of_deleted_user() from public, anon, authenticated;

drop trigger if exists deactivate_profile_of_deleted_user on public."User";
create trigger deactivate_profile_of_deleted_user
  after update of auth_user_id, email on public."User"
  for each row execute function public.deactivate_profile_of_deleted_user();

-- Repair profiles of accounts deleted before this fix.
update public."ProfessionalProfile" pp set "isActive" = false, "updatedAt" = now()
  from public."User" u
  where u.id = pp."userId" and u.auth_user_id is null and u.email like 'deleted+%@invalid.insidely' and pp."isActive";
delete from public."Availability" a
  using public."ProfessionalProfile" pp, public."User" u
  where pp.id = a."professionalProfileId" and u.id = pp."userId" and u.email like 'deleted+%@invalid.insidely' and a."isBooked" = false;
