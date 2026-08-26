-- Keep reports visible in the admin workspace and notify every administrator.
create or replace function public.create_support_report(p_category text, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id text; v_report_id text := gen_random_uuid()::text;
begin
  select id into v_user_id from public."User" where auth_user_id = auth.uid();
  if v_user_id is null or length(trim(p_category)) not between 2 and 80 or length(trim(p_description)) not between 20 and 4000 then raise exception 'invalid_request'; end if;
  insert into public."Report" (id,"reporterId",category,description,status,"createdAt","updatedAt")
  values (v_report_id,v_user_id,trim(p_category),trim(p_description),'OPEN',now(),now());
  insert into public."Notification" (id,"userId",title,body,href,"createdAt")
  select gen_random_uuid()::text,id,'Nova solicitação de suporte','Uma nova solicitação foi enviada para análise.','/admin/suporte',now()
  from public."User" where role = 'ADMIN'::public."Role";
end;
$$;

create or replace function public.create_profile_report(p_profile_id text, p_category text, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare reporter text; target text; v_report_id text := gen_random_uuid()::text;
begin
  select id into reporter from public."User" where auth_user_id = auth.uid();
  select "userId" into target from public."ProfessionalProfile" where id = p_profile_id and "isActive" = true;
  if reporter is null or target is null or reporter = target then raise exception 'invalid_report'; end if;
  if p_category not in ('Foto inadequada','Informação falsa','Assédio ou comportamento abusivo','Outro') then raise exception 'invalid_category'; end if;
  if length(trim(p_description)) not between 20 and 2000 then raise exception 'invalid_description'; end if;
  insert into public."Report" (id,"reporterId","targetUserId",category,description,status,"createdAt","updatedAt")
  values (v_report_id,reporter,target,'Perfil · ' || trim(p_category),trim(p_description),'OPEN',now(),now());
  insert into public."Notification" (id,"userId",title,body,href,"createdAt")
  select gen_random_uuid()::text,id,'Nova denúncia de perfil','Um perfil foi denunciado e precisa de análise.','/admin/denuncias',now()
  from public."User" where role = 'ADMIN'::public."Role";
end;
$$;

-- A booking needs enough time for payment and preparation. This also matches
-- the 15-minute minimum already used when consultants create availability.
create or replace function public.create_booking(p_profile_id text, p_slot_id text, p_duration integer, p_topics text[], p_goals text)
returns text language plpgsql set search_path = 'public' as $$
declare uid text; consultant_uid text; slot public."Availability"; bid text; price integer; fee integer := 500;
begin
  select id into uid from public."User" where auth_user_id = auth.uid() and role in ('USER','ADMIN');
  if uid is null then raise exception 'unauthorized'; end if;
  if p_duration not in (30,60) then raise exception 'invalid_duration'; end if;
  select "userId" into consultant_uid from public."ProfessionalProfile" where id=p_profile_id and "isActive"=true;
  if consultant_uid is null then raise exception 'profile_not_found'; end if;
  select * into slot from public."Availability" where id=p_slot_id and "professionalProfileId"=p_profile_id and "isBooked"=false and "startsAt">now()+interval '15 minutes' for update;
  if slot.id is null then raise exception 'slot_too_soon_or_unavailable'; end if;
  if slot."endsAt" < slot."startsAt" + make_interval(mins=>p_duration) then raise exception 'slot_unavailable'; end if;
  select case when p_duration=60 then "price60Cents" else "price30Cents" end into price from public."ProfessionalProfile" where id=p_profile_id and "isActive"=true;
  if price is null then raise exception 'profile_not_found'; end if;
  bid=gen_random_uuid()::text;
  update public."Availability" set "isBooked"=true where id=p_slot_id and "isBooked"=false;
  if not found then raise exception 'slot_unavailable'; end if;
  insert into public."Booking" (id,"customerId","professionalProfileId","availabilityId","startsAt","durationMinutes",topics,goals,status,"subtotalCents","feeCents","totalCents","createdAt","updatedAt")
  values (bid,uid,p_profile_id,p_slot_id,slot."startsAt",p_duration,coalesce(p_topics,'{}'),coalesce(p_goals,''),'PENDING_PAYMENT'::public."BookingStatus",price,fee,price+fee,now(),now());
  insert into public."Conversation" (id,"bookingId","createdAt","updatedAt") values (gen_random_uuid()::text,bid,now(),now());
  insert into public."Payment" (id,"bookingId",status,"amountCents","createdAt","updatedAt") values (gen_random_uuid()::text,bid,'PENDING'::public."PaymentStatus",price+fee,now(),now());
  insert into public."Notification" (id,"userId",title,body,href,"createdAt") values (gen_random_uuid()::text,consultant_uid,'Nova solicitação de conversa','Alguém escolheu um horário no seu perfil. Revise o pedido e acompanhe o pagamento.','/consultor/consultas',now());
  return bid;
end;
$$;
