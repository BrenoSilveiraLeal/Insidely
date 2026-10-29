-- 1. Google Meet room lifecycle: the space is only created when the conversation starts and is
--    locked and ended after it finishes, so the link cannot be used before or after the slot.
alter table public."Booking" add column if not exists "meetingSpaceName" text;
alter table public."Booking" add column if not exists "meetingClosedAt" timestamp(3) without time zone;

create index if not exists booking_meeting_close_due_idx on public."Booking" ("startsAt")
  where "meetingSpaceName" is not null and "meetingClosedAt" is null;

-- 2. Customer identity. Whoever books a conversation registers a CPF and a birth date (18+). Only the
--    platform reads the full record (service role); consultants see it masked through the app.
create or replace function public.is_valid_cpf(p_cpf text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  v text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_sum integer; v_check integer; i integer;
begin
  if length(v) <> 11 or v ~ '^(.)\1{10}$' then return false; end if;
  for pos in 10..11 loop
    v_sum := 0;
    for i in 1..pos - 1 loop v_sum := v_sum + substr(v, i, 1)::integer * (pos + 1 - i); end loop;
    v_check := (v_sum * 10) % 11;
    if v_check = 10 then v_check := 0; end if;
    if v_check <> substr(v, pos, 1)::integer then return false; end if;
  end loop;
  return true;
end $$;

create table if not exists public."CustomerIdentity" (
  "userId" text primary key references public."User"(id) on delete cascade,
  cpf text not null unique check (cpf ~ '^[0-9]{11}$' and public.is_valid_cpf(cpf)),
  "birthDate" date not null check ("birthDate" > date '1900-01-01'),
  "acceptedAt" timestamp(3) without time zone not null default now(),
  "createdAt" timestamp(3) without time zone not null default now()
);
alter table public."CustomerIdentity" enable row level security;
revoke all on public."CustomerIdentity" from public, anon, authenticated;

-- Registered once by the account owner; changing it afterwards goes through support.
create or replace function public.save_customer_identity(p_cpf text, p_birth_date date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user text;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
begin
  select id into v_user from public."User" where auth_user_id = auth.uid();
  if v_user is null then raise exception 'unauthorized'; end if;
  if not public.is_valid_cpf(v_cpf) then raise exception 'invalid_cpf'; end if;
  if p_birth_date is null or p_birth_date > (current_date - interval '18 years')::date or p_birth_date <= date '1900-01-01' then raise exception 'underage_or_invalid_birth_date'; end if;
  if exists (select 1 from public."CustomerIdentity" where "userId" = v_user) then raise exception 'identity_already_registered'; end if;
  if exists (select 1 from public."CustomerIdentity" where cpf = v_cpf) then raise exception 'cpf_in_use'; end if;
  insert into public."CustomerIdentity" ("userId", cpf, "birthDate") values (v_user, v_cpf, p_birth_date);
end $$;
revoke all on function public.save_customer_identity(text, date) from public, anon;
grant execute on function public.save_customer_identity(text, date) to authenticated;

create or replace function public.has_customer_identity()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public."CustomerIdentity" i join public."User" u on u.id = i."userId" where u.auth_user_id = auth.uid());
$$;
revoke all on function public.has_customer_identity() from public, anon;
grant execute on function public.has_customer_identity() to authenticated;

-- Enforced for every new booking, whichever path inserts it.
create or replace function public.require_customer_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public."CustomerIdentity" where "userId" = new."customerId") then
    raise exception 'identity_required';
  end if;
  return new;
end $$;
revoke all on function public.require_customer_identity() from public, anon, authenticated;
drop trigger if exists booking_requires_customer_identity on public."Booking";
create trigger booking_requires_customer_identity before insert on public."Booking"
  for each row execute function public.require_customer_identity();

-- 3. Chat moderation. Messages only go through send_message (no direct inserts), which refuses
--    contact details and offensive language. Refused attempts are logged by the app for admins.
create table if not exists public."ChatModerationEvent" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references public."User"(id) on delete cascade,
  "conversationId" text references public."Conversation"(id) on delete set null,
  reason text not null check (reason in ('contact', 'offensive')),
  excerpt text not null,
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists chat_moderation_user_idx on public."ChatModerationEvent" ("userId", "createdAt" desc);
alter table public."ChatModerationEvent" enable row level security;
revoke all on public."ChatModerationEvent" from public, anon, authenticated;

drop policy if exists message_participant_insert on public."Message";
revoke insert, update, delete on public."Message" from anon, authenticated;

create or replace function public.send_message(p_conversation_id text, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user text;
  v_booking public."Booking";
  v_text text := lower(translate(coalesce(p_body, ''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'));
  v_numbers text;
begin
  select id into v_user from public."User" where auth_user_id = auth.uid();
  if v_user is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'invalid_message'; end if;
  -- Years are ignored so a career timeline ("2015-2020") is not mistaken for a phone number.
  v_numbers := regexp_replace(v_text, '\m(19|20)[0-9]{2}\M', ' ', 'g');
  if v_text ~ '(https?://|www\.|whats|wpp|\mzap|telegram|instagram|\minsta\M|gmail|hotmail|outlook|chave pix|meu pix|por fora|direto comigo|[[:alnum:]._%+-]+[[:space:]]*@[[:space:]]*[[:alnum:]-]{2,}|(^|[[:space:]])@[[:alnum:]_.]{3,}|[[:alnum:]-]{2,}\.(com|net|org|br|me|io)\M)'
     or v_numbers ~ '[0-9]([[:space:].()/_*+,|-]*[0-9]){7,}' then
    raise exception 'contact_sharing_not_allowed';
  end if;
  if v_text ~ '\m(porra|caralho|foda|fodase|foder|fuder|merda|puta|puto|buceta|arrombad[oa]|fdp|vsf|vtnc|pqp|otari[oa]|idiota|imbecil|babaca|viado|vagabund[oa]|filho da puta)\M' then
    raise exception 'offensive_language';
  end if;
  select b.* into v_booking from public."Conversation" c join public."Booking" b on b.id = c."bookingId" where c.id = p_conversation_id;
  if v_booking.id is null or v_booking.status not in ('CONFIRMED', 'AWAITING_CONFIRMATION') or now() > v_booking."startsAt" + interval '7 days'
     or not (v_booking."customerId" = v_user or exists (select 1 from public."ProfessionalProfile" p where p.id = v_booking."professionalProfileId" and p."userId" = v_user)) then
    raise exception 'not_authorized';
  end if;
  if (select count(*) from public."Message" where "senderId" = v_user and "createdAt" > now() - interval '1 minute') >= 10 then raise exception 'rate_limited'; end if;
  insert into public."Message" (id, "conversationId", "senderId", body, "createdAt") values (gen_random_uuid()::text, p_conversation_id, v_user, trim(p_body), now());
end $$;
revoke execute on function public.send_message(text, text) from public, anon;
grant execute on function public.send_message(text, text) to authenticated;

-- 4. A customer account can add a consultant profile without creating a second account. The same
--    account keeps its bookings, favorites and reviews and can still book as a customer.
create or replace function public.become_consultant(p_payload jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user public."User";
  v_profile_id text;
  v_company_id text := nullif(trim(p_payload->>'companyId'), '');
  v_profession_id text := nullif(trim(p_payload->>'professionId'), '');
  v_years integer;
  v_bio text := trim(coalesce(p_payload->>'bio', ''));
  v_price30 integer;
begin
  select * into v_user from public."User" where auth_user_id = auth.uid() for update;
  if v_user.id is null or not v_user."onboardingCompleted" or v_user.role <> 'USER'::public."Role" then raise exception 'unauthorized'; end if;
  if exists (select 1 from public."ProfessionalProfile" where "userId" = v_user.id) then raise exception 'already_consultant'; end if;
  v_years := greatest(0, least(60, coalesce(nullif(p_payload->>'yearsExperience', '')::integer, 0)));
  v_price30 := greatest(1000, least(100000, round(coalesce(nullif(replace(trim(coalesce(p_payload->>'price30', '')), ',', '.'), '')::numeric, 50) * 100)::integer));
  if length(trim(coalesce(p_payload->>'headline', ''))) < 3 or length(v_bio) < 30
     or length(trim(coalesce(p_payload->>'location', ''))) < 2
     or length(trim(coalesce(p_payload->>'title', ''))) < 2
     or not exists (select 1 from public."Company" where id = v_company_id)
     or not exists (select 1 from public."Profession" where id = v_profession_id) then
    raise exception 'invalid_onboarding_data';
  end if;
  v_profile_id := gen_random_uuid()::text;
  insert into public."ProfessionalProfile" (id, "userId", headline, bio, location, region, "workMode", seniority, "yearsExperience", "price30Cents", "price60Cents", "avatarSeed", topics, boundaries, "updatedAt")
  values (v_profile_id, v_user.id, left(trim(p_payload->>'headline'), 160), left(v_bio, 2000), left(trim(p_payload->>'location'), 160), 'Brasil', 'REMOTE', 'MID', v_years, v_price30, round(v_price30 * 1.8)::integer, auth.uid()::text, '{}', '{}', now());
  insert into public."EmploymentExperience" (id, "professionalProfileId", "companyId", "professionId", title, area, "isCurrent", "startedAt", summary)
  values (gen_random_uuid()::text, v_profile_id, v_company_id, v_profession_id, left(trim(p_payload->>'title'), 160), 'Profissional', true, (current_date - make_interval(years => v_years))::timestamp, left(v_bio, 1000));
  insert into public."PrivacySettings" (id, "professionalProfileId", "updatedAt") values (gen_random_uuid()::text, v_profile_id, now());
  update public."User" set role = 'CONSULTANT'::public."Role", "updatedAt" = now() where id = v_user.id;
  return v_profile_id;
end $$;
revoke all on function public.become_consultant(jsonb) from public, anon;
grant execute on function public.become_consultant(jsonb) to authenticated;
