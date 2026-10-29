-- Every account registers a CPF, consultants included (20261029130000 only required it to book).
-- The app sends accounts without one to /identificacao; the database guarantees the rule for new
-- consultant profiles and for both sides of every new booking.
create or replace function public.require_profile_owner_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public."CustomerIdentity" where "userId" = new."userId") then
    raise exception 'identity_required';
  end if;
  return new;
end $$;
revoke all on function public.require_profile_owner_identity() from public, anon, authenticated;
drop trigger if exists professional_profile_requires_identity on public."ProfessionalProfile";
create trigger professional_profile_requires_identity before insert on public."ProfessionalProfile"
  for each row execute function public.require_profile_owner_identity();

create or replace function public.require_customer_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public."CustomerIdentity" where "userId" = new."customerId") then
    raise exception 'identity_required';
  end if;
  if not exists (
    select 1 from public."ProfessionalProfile" p join public."CustomerIdentity" i on i."userId" = p."userId"
    where p.id = new."professionalProfileId"
  ) then
    raise exception 'consultant_identity_required';
  end if;
  return new;
end $$;
revoke all on function public.require_customer_identity() from public, anon, authenticated;
