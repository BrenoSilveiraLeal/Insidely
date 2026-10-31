-- "Perguntas por mensagem": the request has up to 5 questions (the customer marks the ones they will
-- not use). When paid, each question arrives in the chat as its own message, in order, and the
-- customer sends nothing else. Booking.goals keeps them joined, for the screens that show it.

alter table public."Booking" add column if not exists questions text[];

create or replace function public.create_message_booking(p_profile_id text, p_topics text[], p_goals text, p_questions text[])
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_customer_id text;
  v_consultant_id text;
  v_price integer;
  v_fee integer := 500;
  v_booking_id text := extensions.gen_random_uuid()::text;
  v_questions text[];
begin
  select id into v_customer_id from public."User" where "auth_user_id" = auth.uid() and role in ('USER','CONSULTANT','ADMIN');
  if v_customer_id is null then raise exception 'unauthorized'; end if;
  select "userId", "messagePriceCents" into v_consultant_id, v_price from public."ProfessionalProfile" where id = p_profile_id and "isActive" = true;
  if v_consultant_id is null then raise exception 'profile_not_found'; end if;
  if v_consultant_id = v_customer_id then raise exception 'own_profile'; end if;
  if v_price is null then raise exception 'format_not_offered'; end if;
  select coalesce(array_agg(left(trim(q), 1000) order by n), '{}') into v_questions
    from unnest(coalesce(p_questions, '{}')) with ordinality as t(q, n) where length(trim(q)) > 0;
  if cardinality(v_questions) < 1 or cardinality(v_questions) > 5 then raise exception 'invalid_questions'; end if;
  if exists (select 1 from unnest(v_questions) q where length(q) < 5) then raise exception 'invalid_questions'; end if;
  insert into public."Booking" (id,"customerId","professionalProfileId","availabilityId","startsAt","durationMinutes",topics,goals,questions,status,"subtotalCents","feeCents","totalCents",format,"createdAt","updatedAt")
  values (v_booking_id,v_customer_id,p_profile_id,null,now(),2880,coalesce(p_topics,'{}'),left(trim(coalesce(p_goals,'')),6000),v_questions,'PENDING_PAYMENT'::public."BookingStatus",v_price,v_fee,v_price+v_fee,'MESSAGE',now(),now());
  insert into public."Conversation" (id,"bookingId","createdAt","updatedAt") values (extensions.gen_random_uuid()::text,v_booking_id,now(),now());
  insert into public."Payment" (id,"bookingId",status,"amountCents","createdAt","updatedAt") values (extensions.gen_random_uuid()::text,v_booking_id,'PENDING'::public."PaymentStatus",v_price+v_fee,now(),now());
  insert into public."Notification" (id,"userId",title,body,href,"createdAt") values (extensions.gen_random_uuid()::text,v_consultant_id,'Novo pedido de perguntas por mensagem','Alguém quer tirar dúvidas com você por mensagem. Assim que o pagamento for confirmado, as perguntas chegam no chat e você tem 48 horas para responder.','/consultor/consultas',now());
  return v_booking_id;
end $$;
revoke all on function public.create_message_booking(text, text[], text, text[]) from public, anon;
grant execute on function public.create_message_booking(text, text[], text, text[]) to authenticated;

-- When paid: each question becomes a chat message from the customer (older requests: the single text).
create or replace function public.start_message_window()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_conversation text;
begin
  if new.format = 'MESSAGE' and new.status = 'CONFIRMED'::public."BookingStatus" and old.status is distinct from new.status then
    new."startsAt" := now();
    select c.id into v_conversation from public."Conversation" c where c."bookingId" = new.id;
    if v_conversation is not null and not exists (select 1 from public."Message" m where m."conversationId" = v_conversation and m."senderId" = new."customerId") then
      if cardinality(coalesce(new.questions, '{}')) > 0 then
        insert into public."Message" (id, "conversationId", "senderId", body, "createdAt")
        select gen_random_uuid()::text, v_conversation, new."customerId", q, now() + (n * interval '1 millisecond')
          from unnest(new.questions) with ordinality as t(q, n);
      elsif length(trim(coalesce(new.goals, ''))) > 0 then
        insert into public."Message" (id, "conversationId", "senderId", body, "createdAt")
        values (gen_random_uuid()::text, v_conversation, new."customerId", new.goals, now());
      end if;
    end if;
  end if;
  return new;
end $$;

-- In a message booking the customer sends nothing through the chat: the questions are posted above.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.send_message(text,text)'::regprocedure);
  if position('and "senderId" = v_user) >= 0 then' in v_def) > 0 then return; end if;
  if position('and "senderId" = v_user) >= 1 then' in v_def) = 0 then raise exception 'send_message question limit not found'; end if;
  execute replace(v_def, 'and "senderId" = v_user) >= 1 then', 'and "senderId" = v_user) >= 0 then');
end $$;
