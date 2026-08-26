-- Keep booking atomic while preserving RLS for direct client queries.
create or replace function public.create_booking(p_profile_id text, p_slot_id text, p_duration integer, p_topics text[], p_goals text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_customer_id text;
  v_consultant_id text;
  v_slot public."Availability";
  v_booking_id text;
  v_price integer;
  v_fee integer := 500;
begin
  select id into v_customer_id from public."User"
  where auth_user_id = auth.uid() and role in ('USER','CONSULTANT','ADMIN');
  if v_customer_id is null then raise exception 'unauthorized'; end if;
  if p_duration not in (30,60) then raise exception 'invalid_duration'; end if;

  select "userId" into v_consultant_id from public."ProfessionalProfile"
  where id = p_profile_id and "isActive" = true;
  if v_consultant_id is null then raise exception 'profile_not_found'; end if;

  select * into v_slot from public."Availability"
  where id = p_slot_id and "professionalProfileId" = p_profile_id
    and "isBooked" = false and "startsAt" > now() + interval '15 minutes'
  for update;
  if v_slot.id is null then raise exception 'slot_too_soon_or_unavailable'; end if;
  if v_slot."endsAt" < v_slot."startsAt" + make_interval(mins => p_duration) then raise exception 'slot_unavailable'; end if;

  select case when p_duration = 60 then "price60Cents" else "price30Cents" end into v_price
  from public."ProfessionalProfile" where id = p_profile_id and "isActive" = true;
  if v_price is null then raise exception 'profile_not_found'; end if;

  v_booking_id = gen_random_uuid()::text;
  update public."Availability" set "isBooked" = true where id = p_slot_id and "isBooked" = false;
  if not found then raise exception 'slot_unavailable'; end if;
  insert into public."Booking" (id,"customerId","professionalProfileId","availabilityId","startsAt","durationMinutes",topics,goals,status,"subtotalCents","feeCents","totalCents","createdAt","updatedAt")
  values (v_booking_id,v_customer_id,p_profile_id,p_slot_id,v_slot."startsAt",p_duration,coalesce(p_topics,'{}'),coalesce(p_goals,''),'PENDING_PAYMENT'::public."BookingStatus",v_price,v_fee,v_price+v_fee,now(),now());
  insert into public."Conversation" (id,"bookingId","createdAt","updatedAt") values (gen_random_uuid()::text,v_booking_id,now(),now());
  insert into public."Payment" (id,"bookingId",status,"amountCents","createdAt","updatedAt") values (gen_random_uuid()::text,v_booking_id,'PENDING'::public."PaymentStatus",v_price+v_fee,now(),now());
  insert into public."Notification" (id,"userId",title,body,href,"createdAt") values (gen_random_uuid()::text,v_consultant_id,'Nova solicitação de conversa','Alguém escolheu um horário no seu perfil. Revise o pedido e acompanhe o pagamento.','/consultor/consultas',now());
  return v_booking_id;
end;
$$;

revoke all on function public.create_booking(text,text,integer,text[],text) from public, anon;
grant execute on function public.create_booking(text,text,integer,text[],text) to authenticated;
