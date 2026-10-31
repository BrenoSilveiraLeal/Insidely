-- "Perguntas por mensagem", one question at a time. The request has an optional short greeting and
-- up to 5 questions. When paid, the greeting and the first question arrive in the chat; each time the
-- consultant answers, the next question is sent by the system. Messages sent by the system (these
-- and the consultant's welcome message) are marked "automatic": they never count as an answer, so
-- an unanswered request is still refunded after 48 hours.

alter table public."Message" add column if not exists automatic boolean not null default false;
alter table public."Booking" add column if not exists greeting text;
alter table public."Booking" add column if not exists "questionsSent" integer not null default 0;

-- Requests already paid under the previous rule got every question at once.
update public."Booking" set "questionsSent" = cardinality(questions)
 where format = 'MESSAGE' and questions is not null and status <> 'PENDING_PAYMENT'::public."BookingStatus";

create or replace function public.create_message_booking(p_profile_id text, p_topics text[], p_goals text, p_questions text[], p_greeting text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_booking_id text;
begin
  v_booking_id := public.create_message_booking(p_profile_id, p_topics, p_goals, p_questions);
  update public."Booking" set greeting = nullif(left(trim(coalesce(p_greeting, '')), 140), '') where id = v_booking_id;
  return v_booking_id;
end $$;
revoke all on function public.create_message_booking(text, text[], text, text[], text) from public, anon;
grant execute on function public.create_message_booking(text, text[], text, text[], text) to authenticated;

-- When paid: the greeting (if any) and the first question; older requests without questions: the text.
create or replace function public.start_message_window()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_conversation text;
begin
  if new.format = 'MESSAGE' and new.status = 'CONFIRMED'::public."BookingStatus" and old.status is distinct from new.status then
    new."startsAt" := now();
    select c.id into v_conversation from public."Conversation" c where c."bookingId" = new.id;
    if v_conversation is not null and not exists (select 1 from public."Message" m where m."conversationId" = v_conversation and m."senderId" = new."customerId") then
      if cardinality(coalesce(new.questions, '{}')) > 0 then
        if new.greeting is not null then
          insert into public."Message" (id, "conversationId", "senderId", body, "createdAt", automatic)
          values (gen_random_uuid()::text, v_conversation, new."customerId", new.greeting, clock_timestamp(), true);
        end if;
        insert into public."Message" (id, "conversationId", "senderId", body, "createdAt", automatic)
        values (gen_random_uuid()::text, v_conversation, new."customerId", new.questions[1], clock_timestamp() + interval '1 millisecond', true);
        new."questionsSent" := 1;
      elsif length(trim(coalesce(new.goals, ''))) > 0 then
        insert into public."Message" (id, "conversationId", "senderId", body, "createdAt", automatic)
        values (gen_random_uuid()::text, v_conversation, new."customerId", new.goals, clock_timestamp(), true);
      end if;
    end if;
  end if;
  return new;
end $$;

-- The consultant answered (a message of their own, not an automatic one) the last question sent:
-- the next question goes out. Several replies in a row to the same question send it only once.
create or replace function public.send_next_message_question()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_booking public."Booking"; v_consultant text; v_last_question timestamp;
begin
  if new.automatic then return new; end if;
  select b.* into v_booking from public."Booking" b join public."Conversation" c on c."bookingId" = b.id where c.id = new."conversationId";
  if v_booking.id is null or v_booking.format <> 'MESSAGE' or v_booking.status <> 'CONFIRMED'::public."BookingStatus" then return new; end if;
  if v_booking."questionsSent" >= cardinality(coalesce(v_booking.questions, '{}')) then return new; end if;
  select p."userId" into v_consultant from public."ProfessionalProfile" p where p.id = v_booking."professionalProfileId";
  if new."senderId" is distinct from v_consultant then return new; end if;
  select max(m."createdAt") into v_last_question from public."Message" m where m."conversationId" = new."conversationId" and m."senderId" = v_booking."customerId";
  if exists (select 1 from public."Message" m where m."conversationId" = new."conversationId" and m."senderId" = v_consultant
               and not m.automatic and m.id <> new.id and m."createdAt" > coalesce(v_last_question, '-infinity'::timestamp)) then
    return new;
  end if;
  insert into public."Message" (id, "conversationId", "senderId", body, "createdAt", automatic)
  values (gen_random_uuid()::text, new."conversationId", v_booking."customerId", v_booking.questions[v_booking."questionsSent" + 1], clock_timestamp() + interval '1 millisecond', true);
  update public."Booking" set "questionsSent" = "questionsSent" + 1, "updatedAt" = now() where id = v_booking.id;
  return new;
end $$;
revoke all on function public.send_next_message_question() from public, anon, authenticated;
drop trigger if exists message_send_next_question on public."Message";
create trigger message_send_next_question after insert on public."Message"
  for each row execute function public.send_next_message_question();
