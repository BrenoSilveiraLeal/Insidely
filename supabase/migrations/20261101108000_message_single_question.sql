-- "Perguntas por mensagem": the customer writes every question once, in the request form. When the
-- payment is confirmed, that text arrives in the chat as a single message from the customer, and
-- the customer sends nothing else; the consultant answers within 48 hours. Unanswered requests are
-- refunded by the application (refundUnansweredMessageBookings), which also closes the chat.

create or replace function public.start_message_window()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.format = 'MESSAGE' and new.status = 'CONFIRMED'::public."BookingStatus" and old.status is distinct from new.status then
    new."startsAt" := now();
    insert into public."Message" (id, "conversationId", "senderId", body, "createdAt")
    select gen_random_uuid()::text, c.id, new."customerId", new.goals, now()
      from public."Conversation" c
     where c."bookingId" = new.id
       and length(trim(coalesce(new.goals, ''))) > 0
       and not exists (select 1 from public."Message" m where m."conversationId" = c.id and m."senderId" = new."customerId");
  end if;
  return new;
end $$;

-- The customer's only message is the one above (was: up to 5).
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.send_message(text,text)'::regprocedure);
  if position('and "senderId" = v_user) >= 5 then' in v_def) = 0 then
    if position('and "senderId" = v_user) >= 1 then' in v_def) > 0 then return; end if;
    raise exception 'send_message question limit not found';
  end if;
  execute replace(v_def, 'and "senderId" = v_user) >= 5 then', 'and "senderId" = v_user) >= 1 then');
end $$;
