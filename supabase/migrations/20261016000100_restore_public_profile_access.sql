-- 20261015215127 recreated public_profile_cards with security_invoker = true, but anon has no
-- grants on PrivacySettings, EmploymentExperience, Availability or Review. Every public read of
-- the view failed with "permission denied for table PrivacySettings", breaking search, public
-- profiles and booking. Restore the deliberate owner-rights projection (see README) instead of
-- exposing the base tables to anon.
alter view public.public_profile_cards reset (security_invoker);

-- The company/profession filters read EmploymentExperience directly; run with owner rights so
-- anonymous searches keep working. The function only returns rows from the safe projection.
alter function public.search_public_profiles(text,text,text,text,text,integer,integer) security definer;

revoke all on function public.search_public_profiles(text,text,text,text,text,integer,integer) from public, anon;
grant execute on function public.search_public_profiles(text,text,text,text,text,integer,integer) to anon, authenticated;
grant select on public.public_profile_cards to anon, authenticated;

-- Simulated payments are stored as PAID_HELD; list them alongside HELD/RELEASED so the items
-- match the totals shown on /consultor/ganhos.
create or replace function public.get_consultant_gains(p_user_id text, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_profile text; v_total integer; v_limit integer:=least(greatest(coalesce(p_limit,20),1),100); v_offset integer:=greatest(coalesce(p_offset,0),0); v_released bigint; v_held bigint;
begin
  select pp.id into v_profile from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id where u.id=p_user_id and u."auth_user_id"=auth.uid() and u.role='CONSULTANT'::public."Role";
  if v_profile is null then raise exception 'not_authorized'; end if;
  select count(*) into v_total from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile and p.status in ('HELD'::public."PaymentStatus",'PAID_HELD'::public."PaymentStatus",'RELEASED'::public."PaymentStatus");
  select coalesce(sum(case when p.status='RELEASED'::public."PaymentStatus" then b."totalCents"-b."feeCents" else 0 end),0),coalesce(sum(case when p.status in ('HELD'::public."PaymentStatus",'PAID_HELD'::public."PaymentStatus") then b."totalCents"-b."feeCents" else 0 end),0) into v_released,v_held from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile;
  return jsonb_build_object('items',coalesce((select jsonb_agg(q.item order by q.starts_at desc) from (select to_jsonb(b)||jsonb_build_object('customer',(select jsonb_build_object('name',u.name) from public."User" u where u.id=b."customerId"),'payment',to_jsonb(p)) as item,b."startsAt" as starts_at from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile and p.status in ('HELD'::public."PaymentStatus",'PAID_HELD'::public."PaymentStatus",'RELEASED'::public."PaymentStatus") order by b."startsAt" desc limit v_limit offset v_offset) q),'[]'::jsonb),'total',v_total,'page',floor(v_offset/v_limit)::integer+1,'pageSize',v_limit,'releasedTotalCents',v_released,'heldTotalCents',v_held);
end;
$function$;

revoke all on function public.get_consultant_gains(text,integer,integer) from public, anon;
grant execute on function public.get_consultant_gains(text,integer,integer) to authenticated;

-- Instant slots start "now", so a booking's startsAt is already in the past when the customer
-- reaches checkout. Expire only after the conversation window ends (or after 30 minutes unpaid).
create or replace function public.expire_past_unpaid_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := auth.uid();
  v_user_id text;
  v_count integer := 0;
  b record;
begin
  if v_auth is null then
    if current_setting('role', true) is distinct from 'service_role' and session_user <> 'postgres' then
      raise exception 'not_authorized';
    end if;
  else
    select id into v_user_id from public."User" where "auth_user_id" = v_auth;
    if v_user_id is null then raise exception 'not_authorized'; end if;
  end if;

  for b in
    select bk.id, bk."customerId", pp."userId" as consultant_user_id, bk."availabilityId"
    from public."Booking" bk
    join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
    join public."Payment" pay on pay."bookingId" = bk.id
    where bk.status = 'PENDING_PAYMENT'::public."BookingStatus"
      and (bk."startsAt" + make_interval(mins => bk."durationMinutes") < now() or bk."createdAt" < now() - interval '30 minutes')
      and pay.status in ('PENDING'::public."PaymentStatus", 'FAILED'::public."PaymentStatus")
      and (v_user_id is null or bk."customerId" = v_user_id or pp."userId" = v_user_id)
    for update of bk skip locked
  loop
    update public."Booking"
      set status = 'EXPIRED'::public."BookingStatus", "updatedAt" = now()
      where id = b.id and status = 'PENDING_PAYMENT'::public."BookingStatus";
    if not found then continue; end if;

    update public."Availability"
      set "isBooked" = false
      where id = b."availabilityId" and "isBooked" = true;

    insert into public."Notification" (id, "userId", title, body, href, "createdAt")
    values
      (gen_random_uuid()::text, b."customerId", 'Agendamento expirado', 'O pagamento não foi concluído em até 30 minutos. O registro foi mantido no histórico e o horário liberado.', '/dashboard/agendamentos', now()),
      (gen_random_uuid()::text, b.consultant_user_id, 'Solicitação expirada', 'O pagamento não foi concluído em até 30 minutos. O registro foi mantido no histórico e o horário liberado.', '/consultor/consultas', now());

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.expire_past_unpaid_bookings() from public, anon;
grant execute on function public.expire_past_unpaid_bookings() to authenticated, service_role;

-- Accept any open slot with at least 10 minutes left (including instant slots that already
-- started), matching what the booking page lists.
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
    and "isBooked" = false and "endsAt" >= now() + interval '10 minutes'
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

revoke all on function public.create_booking(text,text,integer,text[],text) from public, anon;
grant execute on function public.create_booking(text,text,integer,text[],text) to authenticated;

-- Conversations can be confirmed once they have started (they may end early). A consultant who
-- booked their own profile for testing confirms both sides at once instead of getting stuck.
create or replace function public.confirm_booking(p_booking_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user text; v_booking public."Booking"; v_is_consultant boolean;
begin
  select id into v_user from public."User" where "auth_user_id" = auth.uid();
  select * into v_booking from public."Booking" where id = p_booking_id for update;
  if v_booking.id is null or v_booking.status not in ('CONFIRMED','AWAITING_CONFIRMATION') then raise exception 'invalid_state'; end if;
  if v_booking."startsAt" > now() then raise exception 'not_started'; end if;
  v_is_consultant := exists(select 1 from public."ProfessionalProfile" where id = v_booking."professionalProfileId" and "userId" = v_user);
  if v_booking."customerId" is distinct from v_user and not v_is_consultant then raise exception 'not_authorized'; end if;
  update public."Booking" set
    "customerConfirmedAt" = case when v_booking."customerId" = v_user then coalesce("customerConfirmedAt", now()) else "customerConfirmedAt" end,
    "consultantConfirmedAt" = case when v_is_consultant then coalesce("consultantConfirmedAt", now()) else "consultantConfirmedAt" end,
    status = 'AWAITING_CONFIRMATION', "updatedAt" = now()
  where id = p_booking_id;
  if (select "customerConfirmedAt" is not null and "consultantConfirmedAt" is not null from public."Booking" where id = p_booking_id) then
    if exists (select 1 from public."Payment" where "bookingId" = p_booking_id and provider = 'SIMULATION') then
      update public."Payment" set status = 'RELEASED', "releasedAt" = now(), "updatedAt" = now() where "bookingId" = p_booking_id;
      update public."Booking" set status = 'COMPLETED', "updatedAt" = now() where id = p_booking_id;
    else
      update public."Booking" set status = 'COMPLETED_RELEASE_PENDING', "updatedAt" = now() where id = p_booking_id;
    end if;
  end if;
end
$function$;

revoke all on function public.confirm_booking(text) from public, anon;
grant execute on function public.confirm_booking(text) to authenticated;

-- A consultant may test-book their own profile, but must not review it.
create or replace function public.create_review(p_booking_id text, p_rating integer, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user text;
  v_booking public."Booking";
begin
  select id into v_user from public."User" where "auth_user_id" = auth.uid();
  if v_user is null or p_rating not between 1 and 5 or length(trim(p_comment)) < 12 then
    raise exception 'invalid_request';
  end if;
  select * into v_booking from public."Booking"
    where id = p_booking_id and "customerId" = v_user and status = 'COMPLETED'::public."BookingStatus";
  if v_booking.id is null or exists (select 1 from public."Review" where "bookingId" = p_booking_id) then
    raise exception 'not_reviewable';
  end if;
  if exists (select 1 from public."ProfessionalProfile" where id = v_booking."professionalProfileId" and "userId" = v_user) then
    raise exception 'self_review';
  end if;
  insert into public."Review" (id, "bookingId", "userId", "professionalProfileId", rating, clarity, usefulness, contextualization, comment, "createdAt")
  values (extensions.gen_random_uuid()::text, v_booking.id, v_user, v_booking."professionalProfileId", p_rating, p_rating, p_rating, p_rating, trim(p_comment), now());
end;
$function$;

revoke all on function public.create_review(text, integer, text) from public, anon;
grant execute on function public.create_review(text, integer, text) to authenticated;

-- Honor the "automatic after 24 hours" promise for simulated payments too, for either
-- participant, including conversations nobody marked as finished.
create or replace function public.release_eligible_bookings_for_user()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_user_id text;
  v_count integer := 0;
  b record;
begin
  select id into v_user_id from public."User" where "auth_user_id" = v_uid;
  if v_user_id is null then raise exception 'not_authorized'; end if;

  for b in
    select bk.id, bk."customerId", pp."userId" as consultant_user_id
    from public."Booking" bk
    join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
    join public."Payment" pay on pay."bookingId" = bk.id
    where (pp."userId" = v_user_id or bk."customerId" = v_user_id)
      and bk.status in ('CONFIRMED'::public."BookingStatus", 'AWAITING_CONFIRMATION'::public."BookingStatus")
      and bk."disputedAt" is null
      and (pay.status = 'HELD'::public."PaymentStatus" or (pay.status = 'PAID_HELD'::public."PaymentStatus" and pay.provider = 'SIMULATION'))
      and coalesce(bk."autoReleaseAt", bk."startsAt" + ((bk."durationMinutes" + 1440) * interval '1 minute')) <= now()
    for update of bk skip locked
  loop
    update public."Booking" set status = 'COMPLETED'::public."BookingStatus", "updatedAt" = now() where id = b.id;
    update public."Payment" set status = 'RELEASED'::public."PaymentStatus", "releasedAt" = now(), "updatedAt" = now() where "bookingId" = b.id;

    insert into public."Notification" ("id","userId",title,body,href,"createdAt")
    values
      (gen_random_uuid()::text, b.consultant_user_id, 'Repasse liberado', 'O prazo de confirmação terminou sem contestação. O repasse demonstrativo foi liberado.', '/consultor/ganhos', now()),
      (gen_random_uuid()::text, b."customerId", 'Conversa concluída', 'O prazo de confirmação terminou sem contestação.', '/dashboard/avaliacoes', now());

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.release_eligible_bookings_for_user() from public, anon;
grant execute on function public.release_eligible_bookings_for_user() to authenticated;
