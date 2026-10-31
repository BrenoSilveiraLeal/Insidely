-- Second conversation format: "Perguntas por mensagem". The customer pays, the chat opens at once
-- for 48 hours, and they can send up to 5 messages (questions); the consultant answers in the same
-- chat. No video room, no time slot. Video conversations keep working as before.
--
-- A message booking reuses the booking timeline: startsAt is when the chat opens (reset to the
-- payment time) and durationMinutes is the 48-hour window, so closing, confirmation, release and
-- reviews follow the same rules as a video conversation that ends at startsAt + duration.

alter table public."ProfessionalProfile" add column if not exists "messagePriceCents" integer
  check ("messagePriceCents" is null or "messagePriceCents" between 500 and 100000);

alter table public."Booking" add column if not exists format text not null default 'VIDEO'
  check (format in ('VIDEO', 'MESSAGE'));
create index if not exists "Booking_format_idx" on public."Booking" (format) where format = 'MESSAGE';

create or replace function public.create_message_booking(p_profile_id text, p_topics text[], p_goals text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id text;
  v_consultant_id text;
  v_price integer;
  v_fee integer := 500;
  v_booking_id text := extensions.gen_random_uuid()::text;
begin
  select id into v_customer_id from public."User" where "auth_user_id" = auth.uid() and role in ('USER','CONSULTANT','ADMIN');
  if v_customer_id is null then raise exception 'unauthorized'; end if;
  select "userId", "messagePriceCents" into v_consultant_id, v_price from public."ProfessionalProfile" where id = p_profile_id and "isActive" = true;
  if v_consultant_id is null then raise exception 'profile_not_found'; end if;
  if v_price is null then raise exception 'format_not_offered'; end if;
  if v_consultant_id = v_customer_id then raise exception 'own_profile'; end if;
  if length(trim(coalesce(p_goals, ''))) < 12 then raise exception 'invalid_goals'; end if;
  insert into public."Booking" (id,"customerId","professionalProfileId","availabilityId","startsAt","durationMinutes",topics,goals,status,"subtotalCents","feeCents","totalCents",format,"createdAt","updatedAt")
  values (v_booking_id,v_customer_id,p_profile_id,null,now(),2880,coalesce(p_topics,'{}'),left(trim(p_goals),2000),'PENDING_PAYMENT'::public."BookingStatus",v_price,v_fee,v_price+v_fee,'MESSAGE',now(),now());
  insert into public."Conversation" (id,"bookingId","createdAt","updatedAt") values (extensions.gen_random_uuid()::text,v_booking_id,now(),now());
  insert into public."Payment" (id,"bookingId",status,"amountCents","createdAt","updatedAt") values (extensions.gen_random_uuid()::text,v_booking_id,'PENDING'::public."PaymentStatus",v_price+v_fee,now(),now());
  insert into public."Notification" (id,"userId",title,body,href,"createdAt") values (extensions.gen_random_uuid()::text,v_consultant_id,'Novo pedido de perguntas por mensagem','Alguém quer tirar dúvidas com você por mensagem. Assim que o pagamento for confirmado, o chat abre por 48 horas.','/consultor/consultas',now());
  return v_booking_id;
end $$;
revoke all on function public.create_message_booking(text, text[], text) from public, anon;
grant execute on function public.create_message_booking(text, text[], text) to authenticated;

-- When a message booking is paid, its 48-hour window starts then.
create or replace function public.start_message_window()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.format = 'MESSAGE' and new.status = 'CONFIRMED'::public."BookingStatus" and old.status is distinct from new.status then
    new."startsAt" := now();
  end if;
  return new;
end $$;
drop trigger if exists booking_start_message_window on public."Booking";
create trigger booking_start_message_window before update of status on public."Booking"
  for each row execute function public.start_message_window();

-- At most 5 messages from the customer in a message booking (their questions and follow-ups).
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.send_message(text,text)'::regprocedure);
  v_def := replace(v_def,
    $old$  if (select count(*) from public."Message" where "senderId" = v_user and "createdAt" > now() - interval '1 minute') >= 10 then raise exception 'rate_limited'; end if;$old$,
    $new$  if (select count(*) from public."Message" where "senderId" = v_user and "createdAt" > now() - interval '1 minute') >= 10 then raise exception 'rate_limited'; end if;
  if v_booking.format = 'MESSAGE' and v_user = v_booking."customerId"
     and (select count(*) from public."Message" where "conversationId" = p_conversation_id and "senderId" = v_user) >= 5 then
    raise exception 'question_limit';
  end if;$new$);
  if v_def !~ 'question_limit' then raise exception 'send_message rate-limit line not found'; end if;
  execute v_def;
end $$;

-- Public profiles show the message price (null = this consultant does not offer the format).
do $$
declare v_def text;
begin
  v_def := pg_get_viewdef('public.public_profile_cards'::regclass, true);
  if v_def ~ 'messagePriceCents' then return; end if;
  if position(E'AS availability\n   FROM "ProfessionalProfile" p' in v_def) = 0 then raise exception 'view tail not found'; end if;
  v_def := replace(v_def, E'AS availability\n   FROM "ProfessionalProfile" p', E'AS availability,\n    p."messagePriceCents"\n   FROM "ProfessionalProfile" p');
  execute 'create or replace view public.public_profile_cards as ' || v_def;
end $$;
