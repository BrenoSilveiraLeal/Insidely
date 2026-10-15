-- Enable immediate 30-minute conversations without relaxing the remaining booking checks.
create or replace function public.create_consultant_availability(p_user_id text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_profile_id text;
  v_slot jsonb;
begin
  select pp.id into v_profile_id
  from public."ProfessionalProfile" pp
  join public."User" u on u.id = pp."userId"
  where pp."userId" = p_user_id
    and u."auth_user_id" = v_uid
    and u.role = 'CONSULTANT'::public."Role";

  if v_profile_id is null then raise exception 'profile_not_found'; end if;
  if p_starts_at < now() - interval '1 minute' or p_ends_at <= p_starts_at then
    raise exception 'invalid_time_range';
  end if;

  if exists (
    select 1 from public."Availability" a
    where a."professionalProfileId" = v_profile_id
      and a."startsAt" < p_ends_at
      and a."endsAt" > p_starts_at
  ) then raise exception 'availability_conflict'; end if;

  insert into public."Availability" (id, "professionalProfileId", "startsAt", "endsAt", "isBooked", "createdAt")
  values (extensions.gen_random_uuid()::text, v_profile_id, p_starts_at, p_ends_at, false, now())
  returning to_jsonb("Availability".*) into v_slot;

  return v_slot;
end;
$function$;

create or replace function public.create_booking(p_profile_id text, p_slot_id text, p_duration integer, p_topics text[], p_goals text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_id text;
  v_consultant_id text;
  v_slot public."Availability";
  v_booking_id text;
  v_price integer;
  v_fee integer := 500;
begin
  select id into v_customer_id from public."User"
  where "auth_user_id" = auth.uid() and role in ('USER','CONSULTANT','ADMIN');
  if v_customer_id is null then raise exception 'unauthorized'; end if;
  if p_duration not in (30,60) then raise exception 'invalid_duration'; end if;

  select "userId" into v_consultant_id from public."ProfessionalProfile"
  where id = p_profile_id and "isActive" = true;
  if v_consultant_id is null then raise exception 'profile_not_found'; end if;

  select * into v_slot from public."Availability"
  where id = p_slot_id and "professionalProfileId" = p_profile_id
    and "isBooked" = false and "startsAt" > now() - interval '5 minutes'
    and "endsAt" > now()
  for update;
  if v_slot.id is null then raise exception 'slot_too_soon_or_unavailable'; end if;
  if v_slot."endsAt" < v_slot."startsAt" + make_interval(mins => p_duration) then raise exception 'slot_unavailable'; end if;

  select case when p_duration = 60 then "price60Cents" else "price30Cents" end into v_price
  from public."ProfessionalProfile" where id = p_profile_id and "isActive" = true;
  if v_price is null then raise exception 'profile_not_found'; end if;

  v_booking_id := extensions.gen_random_uuid()::text;
  update public."Availability" set "isBooked" = true where id = p_slot_id and "isBooked" = false;
  if not found then raise exception 'slot_unavailable'; end if;
  insert into public."Booking" (id,"customerId","professionalProfileId","availabilityId","startsAt","durationMinutes",topics,goals,status,"subtotalCents","feeCents","totalCents","createdAt","updatedAt")
  values (v_booking_id,v_customer_id,p_profile_id,p_slot_id,v_slot."startsAt",p_duration,coalesce(p_topics,'{}'),coalesce(p_goals,''),'PENDING_PAYMENT'::public."BookingStatus",v_price,v_fee,v_price+v_fee,now(),now());
  insert into public."Conversation" (id,"bookingId","createdAt","updatedAt") values (extensions.gen_random_uuid()::text,v_booking_id,now(),now());
  insert into public."Payment" (id,"bookingId",status,"amountCents","createdAt","updatedAt") values (extensions.gen_random_uuid()::text,v_booking_id,'PENDING'::public."PaymentStatus",v_price+v_fee,now(),now());
  insert into public."Notification" (id,"userId",title,body,href,"createdAt") values (extensions.gen_random_uuid()::text,v_consultant_id,'Nova solicitação de conversa','Alguém escolheu um horário no seu perfil. Revise o pedido e acompanhe o pagamento.','/consultor/consultas',now());
  return v_booking_id;
end;
$function$;

revoke all on function public.create_consultant_availability(text,timestamptz,timestamptz) from public, anon;
grant execute on function public.create_consultant_availability(text,timestamptz,timestamptz) to authenticated;
revoke all on function public.create_booking(text,text,integer,text[],text) from public, anon;
grant execute on function public.create_booking(text,text,integer,text[],text) to authenticated;

-- Keep currently running slots visible on public profiles for immediate bookings.
create or replace view public.public_profile_cards with (security_invoker = true) as
select
  p.id,
  p.headline,
  case when coalesce(ps."showCity", false) then p.location else '' end as location,
  p."workMode",
  p."price30Cents",
  p."privacyMode",
  p.pseudonym,
  p."verificationStatus",
  jsonb_build_object(
    'name', case
      when coalesce(ps."showRealName", false) then
        case when coalesce(ps."showSurname", false)
          then coalesce(nullif(trim(concat_ws(' ', split_part(u.name, ' ', 1), p."publicSurname")), ''), split_part(u.name, ' ', 1))
          else split_part(u.name, ' ', 1)
        end
      else coalesce(p.pseudonym, 'Pessoa da comunidade')
    end,
    'image', case when coalesce(ps."showPhoto", false) then u.image else null end
  ) as "user",
  jsonb_build_object(
    'showRealName', coalesce(ps."showRealName", false),
    'showSurname', coalesce(ps."showSurname", false),
    'showPhoto', coalesce(ps."showPhoto", false),
    'showCurrentCompany', coalesce(ps."showCurrentCompany", false),
    'showCity', coalesce(ps."showCity", false),
    'showExactDates', coalesce(ps."showExactDates", false),
    'showFullHistory', coalesce(ps."showFullHistory", false),
    'searchableByCompany', coalesce(ps."searchableByCompany", false),
    'searchableByProfession', coalesce(ps."searchableByProfession", false)
  ) as privacy,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'company', jsonb_build_object(
            'name', case when coalesce(ps."showCurrentCompany", false) then c.name else 'Empresa não divulgada' end
          ),
          'profession', jsonb_build_object('name', pr.name)
        )
      )
      from public."EmploymentExperience" e
      join public."Company" c on c.id = e."companyId"
      join public."Profession" pr on pr.id = e."professionId"
      where e."professionalProfileId" = p.id
        and (coalesce(ps."showFullHistory", false) or e."isCurrent" = true)
    ),
    '[]'::jsonb
  ) as experiences,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'comment', r.comment,
          'user', jsonb_build_object('name', coalesce(ru.name, 'Consultante'))
        )
      )
      from public."Review" r
      join public."User" ru on ru.id = r."userId"
      where r."professionalProfileId" = p.id
    ),
    '[]'::jsonb
  ) as reviews,
  p.bio,
  p.region,
  p.seniority,
  p."yearsExperience",
  p."price60Cents",
  p."responseHours",
  p.topics,
  p.boundaries,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'startsAt', a."startsAt",
          'endsAt', a."endsAt",
          'isBooked', a."isBooked"
        ) order by a."startsAt"
      )
      from public."Availability" a
      where a."professionalProfileId" = p.id
        and a."isBooked" = false
        and a."endsAt" > now()
    ),
    '[]'::jsonb
  ) as availability
from public."ProfessionalProfile" p
join public."User" u on u.id = p."userId"
left join public."PrivacySettings" ps on ps."professionalProfileId" = p.id
where p."isActive" = true;
