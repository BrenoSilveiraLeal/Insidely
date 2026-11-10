-- Conversations are chat only (docs/superpowers/specs/2026-11-09-chat-only-anonymity-design.md).
-- Video conversations end: no new time-slot bookings; old ones stay as history.
-- The paid chat opens when the payment is confirmed and lasts at most 72 hours. The customer writes
-- freely (no more "5 questions, one at a time"). It closes when the customer says the questions were
-- answered, when the consultant ends it, after 24 hours with nobody writing, or at 72 hours; the
-- payment stays held 24 more hours for a contest. Never answered in 24 hours: full refund.

-- 1) One price per chat; profiles that only had video prices get the 30-minute price.
update public."ProfessionalProfile" set "messagePriceCents" = least(greatest("price30Cents", 500), 100000)
 where "messagePriceCents" is null;
-- The old 30/60-minute columns mirror the chat price, so search cards and price sorting show it.
update public."ProfessionalProfile" set "price30Cents" = "messagePriceCents", "price60Cents" = "messagePriceCents"
 where "price30Cents" is distinct from "messagePriceCents" or "price60Cents" is distinct from "messagePriceCents";

-- New consultants set one price in the onboarding (saved as price30Cents): it is their chat price.
create or replace function public.default_chat_price()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new."messagePriceCents" is null and new."price30Cents" is not null then
    new."messagePriceCents" := least(greatest(new."price30Cents", 500), 100000);
  end if;
  return new;
end $$;
drop trigger if exists professional_profile_default_chat_price on public."ProfessionalProfile";
create trigger professional_profile_default_chat_price before insert or update on public."ProfessionalProfile"
  for each row execute function public.default_chat_price();

-- Weekly hours the consultant usually answers (shown on the profile; never blocks a purchase):
-- [{"day":1,"start":"19:00","end":"22:00"}, ...], day 0 = Sunday, Brasília time.
alter table public."ProfessionalProfile" add column if not exists "chatHours" jsonb not null default '[]'::jsonb;

-- 2) No new video bookings (time slots) or reschedules.
revoke execute on function public.create_booking(text,text,integer,text[],text) from authenticated;

-- 3) New chats last 72 hours (4320 minutes) instead of 48.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.create_message_booking(text,text[],text,text[])'::regprocedure);
  if position('now(),4320,' in v_def) > 0 then return; end if;
  if position('now(),2880,' in v_def) = 0 then raise exception 'create_message_booking duration not found'; end if;
  v_def := replace(v_def, 'now(),2880,', 'now(),4320,');
  v_def := replace(v_def, '''Novo pedido de perguntas por mensagem''', '''Novo pedido de chat''');
  v_def := replace(v_def, '''Alguém quer tirar dúvidas com você por mensagem. Assim que o pagamento for confirmado, as perguntas chegam no chat e você tem 48 horas para responder.''',
    '''Alguém quer conversar com você pelo chat. Assim que o pagamento for confirmado, a primeira mensagem chega e você tem 24 horas para responder.''');
  execute v_def;
end $$;

-- 4) The customer writes freely in the chat (the limit is only against abuse).
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.send_message(text,text)'::regprocedure);
  if position('and "senderId" = v_user) >= 500 then' in v_def) > 0 then return; end if;
  if position('and "senderId" = v_user) >= 0 then' in v_def) = 0 then raise exception 'send_message customer limit not found'; end if;
  execute replace(v_def, 'and "senderId" = v_user) >= 0 then', 'and "senderId" = v_user) >= 500 then');
end $$;

-- 5) Automatic closing (every 10 minutes).
create or replace function public.close_idle_message_chats()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  b record;
  v_count integer := 0;
  v_last timestamp;
  v_answered boolean;
begin
  for b in
    select bk.id, bk."customerId", bk."startsAt", pp."userId" as consultant_id, c.id as conversation_id,
           pay.provider, pay.status as payment_status
      from public."Booking" bk
      join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
      join public."Conversation" c on c."bookingId" = bk.id
      left join public."Payment" pay on pay."bookingId" = bk.id
     where bk.format = 'MESSAGE' and bk.status = 'CONFIRMED'::public."BookingStatus" and bk."disputedAt" is null
       and bk."startsAt" < now() - interval '24 hours'
     for update of bk skip locked
  loop
    v_answered := exists (select 1 from public."Message" m where m."conversationId" = b.conversation_id and m."senderId" = b.consultant_id and not m.automatic);
    if not v_answered then
      -- Never answered: simulated payments are refunded here; real (Stripe) ones by the daily job,
      -- which needs the payment provider.
      if b.provider = 'SIMULATION' then
        update public."Booking" set status = 'CANCELLED'::public."BookingStatus", "updatedAt" = now() where id = b.id;
        update public."Payment" set status = 'REFUNDED'::public."PaymentStatus", "updatedAt" = now()
         where "bookingId" = b.id and status in ('HELD'::public."PaymentStatus", 'PAID_HELD'::public."PaymentStatus", 'APPROVED'::public."PaymentStatus");
        insert into public."Notification" (id, "userId", title, body, href, "createdAt") values
          (extensions.gen_random_uuid()::text, b."customerId", 'Chat sem resposta: valor devolvido', 'O consultor não respondeu em 24 horas. O valor integral foi devolvido e o chat foi encerrado.', '/conversa/' || b.id, now()),
          (extensions.gen_random_uuid()::text, b.consultant_id, 'Chat encerrado sem resposta', 'Passaram 24 horas sem resposta sua. O cliente recebeu o valor de volta e o chat foi encerrado.', '/conversa/' || b.id, now());
        v_count := v_count + 1;
      end if;
      continue;
    end if;
    select max(m."createdAt") into v_last from public."Message" m where m."conversationId" = b.conversation_id and not m.automatic;
    if coalesce(v_last, b."startsAt") < now() - interval '24 hours' or b."startsAt" < now() - interval '72 hours' then
      update public."Booking" set status = 'AWAITING_CONFIRMATION'::public."BookingStatus",
             "consultantConfirmedAt" = coalesce("consultantConfirmedAt", now()),
             "durationMinutes" = greatest(1, ceil(extract(epoch from (now() - "startsAt")) / 60)::integer),
             "autoReleaseAt" = now() + interval '24 hours', "updatedAt" = now()
       where id = b.id;
      insert into public."Notification" (id, "userId", title, body, href, "createdAt") values
        (extensions.gen_random_uuid()::text, b."customerId", 'Chat encerrado', 'O chat foi encerrado automaticamente. Se suas dúvidas não foram respondidas, conteste em até 24 horas pelo chat; depois disso o pagamento é liberado ao consultor.', '/conversa/' || b.id, now()),
        (extensions.gen_random_uuid()::text, b.consultant_id, 'Chat encerrado', 'O chat foi encerrado automaticamente. Sem contestação do cliente em 24 horas, o pagamento é liberado para você.', '/conversa/' || b.id, now());
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;
revoke all on function public.close_idle_message_chats() from public, anon, authenticated;
grant execute on function public.close_idle_message_chats() to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'close-idle-message-chats';
    perform cron.schedule('close-idle-message-chats', '*/10 * * * *', 'select public.close_idle_message_chats()');
  end if;
end $$;

-- 6) The customer may cancel a chat until the consultant's first answer: full refund (no fee), or no
--    charge when still unpaid. After the first answer there is no cancellation; the customer contests
--    when the chat closes and support decides (full, partial or no refund).
create or replace function public.customer_cancel_chat(p_booking_id text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user text;
  v_booking public."Booking";
  v_consultant text;
  v_paid boolean;
begin
  select id into v_user from public."User" where "auth_user_id" = auth.uid();
  if v_user is null then raise exception 'not_authorized'; end if;
  select * into v_booking from public."Booking" where id = p_booking_id and "customerId" = v_user for update;
  if v_booking.id is null or v_booking.format <> 'MESSAGE' then raise exception 'not_authorized'; end if;
  if v_booking.status not in ('PENDING_PAYMENT'::public."BookingStatus", 'CONFIRMED'::public."BookingStatus") then raise exception 'invalid_state'; end if;
  select "userId" into v_consultant from public."ProfessionalProfile" where id = v_booking."professionalProfileId";
  if exists (select 1 from public."Message" m join public."Conversation" c on c.id = m."conversationId"
              where c."bookingId" = p_booking_id and m."senderId" = v_consultant and not m.automatic) then
    raise exception 'already_answered';
  end if;
  v_paid := exists (select 1 from public."Payment" where "bookingId" = p_booking_id and status in ('PAID_HELD'::public."PaymentStatus", 'HELD'::public."PaymentStatus", 'APPROVED'::public."PaymentStatus"));
  if v_paid then
    update public."Payment" set status = 'REFUNDED'::public."PaymentStatus", "updatedAt" = now() where "bookingId" = p_booking_id;
  else
    update public."Payment" set status = 'FAILED'::public."PaymentStatus", "updatedAt" = now() where "bookingId" = p_booking_id and status = 'PENDING'::public."PaymentStatus";
  end if;
  update public."Booking" set status = 'CANCELLED'::public."BookingStatus", "updatedAt" = now() where id = p_booking_id;
  insert into public."Notification" (id, "userId", title, body, href, "createdAt") values
    (extensions.gen_random_uuid()::text, v_user, 'Chat cancelado', case when v_paid then 'O valor integral será devolvido ao meio de pagamento utilizado.' else 'Seu pedido foi cancelado sem cobrança.' end, '/dashboard/mensagens', now()),
    (extensions.gen_random_uuid()::text, v_consultant, 'Chat cancelado pelo cliente', 'O cliente cancelou o chat antes da sua resposta' || case when nullif(trim(coalesce(p_reason, '')), '') is not null then ': ' || left(trim(p_reason), 300) else '.' end, '/consultor/consultas', now());
end $$;
revoke all on function public.customer_cancel_chat(text, text) from public, anon;
grant execute on function public.customer_cancel_chat(text, text) to authenticated;

-- 7) No more reschedules (video only).
do $$
begin
  if to_regprocedure('public.request_booking_reschedule(text,text,integer)') is not null then
    revoke execute on function public.request_booking_reschedule(text,text,integer) from authenticated;
  end if;
end $$;
