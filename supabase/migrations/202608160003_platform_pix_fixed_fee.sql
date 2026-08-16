create or replace function public.create_booking(p_profile_id text, p_slot_id text, p_duration integer, p_topics text[], p_goals text)
returns text language plpgsql set search_path to 'public' as $$
declare uid text; slot public."Availability"; bid text; price integer; fee integer := 500;
begin
 select id into uid from public."User" where auth_user_id=auth.uid() and role in ('USER','ADMIN');
 if uid is null then raise exception 'unauthorized'; end if;
 if p_duration not in (30,60) then raise exception 'invalid_duration'; end if;
 select * into slot from public."Availability" where id=p_slot_id and "professionalProfileId"=p_profile_id and "isBooked"=false and "startsAt">now() for update;
 if slot.id is null or slot."endsAt" < slot."startsAt"+make_interval(mins=>p_duration) then raise exception 'slot_unavailable'; end if;
 select case when p_duration=60 then "price60Cents" else "price30Cents" end into price from public."ProfessionalProfile" where id=p_profile_id and "isActive"=true;
 if price is null then raise exception 'profile_not_found'; end if;
 bid=gen_random_uuid()::text;
 update public."Availability" set "isBooked"=true where id=p_slot_id and "isBooked"=false;
 if not found then raise exception 'slot_unavailable'; end if;
 insert into public."Booking"(id,"customerId","professionalProfileId","availabilityId","startsAt","durationMinutes",topics,goals,status,"subtotalCents","feeCents","totalCents","createdAt","updatedAt") values(bid,uid,p_profile_id,p_slot_id,slot."startsAt",p_duration,coalesce(p_topics,'{}'),coalesce(p_goals,''),'PENDING_PAYMENT'::public."BookingStatus",price,fee,price+fee,now(),now());
 insert into public."Conversation"(id,"bookingId","createdAt","updatedAt") values(gen_random_uuid()::text,bid,now(),now());
 insert into public."Payment"(id,"bookingId",status,"amountCents","createdAt","updatedAt") values(gen_random_uuid()::text,bid,'PENDING'::public."PaymentStatus",price+fee,now(),now());
 return bid;
end $$;
