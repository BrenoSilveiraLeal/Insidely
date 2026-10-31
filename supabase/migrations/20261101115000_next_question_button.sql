-- "Perguntas por mensagem": a consultant's message no longer releases the next question by itself (a
-- "Boa tarde" did). The consultant answers freely and then presses "Enviar próxima pergunta", which
-- works once they wrote something since the last question was sent.
drop trigger if exists message_send_next_question on public."Message";

create or replace function public.send_next_message_question(p_booking_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user text; v_booking public."Booking"; v_conversation text; v_last_question timestamp;
begin
  select id into v_user from public."User" where auth_user_id = auth.uid();
  select * into v_booking from public."Booking" where id = p_booking_id for update;
  if v_booking.id is null or v_booking.format <> 'MESSAGE' or v_booking.status <> 'CONFIRMED'::public."BookingStatus" then raise exception 'invalid_state'; end if;
  if not exists (select 1 from public."ProfessionalProfile" p where p.id = v_booking."professionalProfileId" and p."userId" = v_user) then raise exception 'not_authorized'; end if;
  if v_booking."questionsSent" >= cardinality(coalesce(v_booking.questions, '{}')) then raise exception 'no_more_questions'; end if;
  select c.id into v_conversation from public."Conversation" c where c."bookingId" = v_booking.id;
  select max(m."createdAt") into v_last_question from public."Message" m where m."conversationId" = v_conversation and m."senderId" = v_booking."customerId";
  if not exists (select 1 from public."Message" m where m."conversationId" = v_conversation and m."senderId" = v_user and not m.automatic
                   and m."createdAt" > coalesce(v_last_question, '-infinity'::timestamp)) then
    raise exception 'not_answered';
  end if;
  insert into public."Message" (id, "conversationId", "senderId", body, "createdAt", automatic)
  values (gen_random_uuid()::text, v_conversation, v_booking."customerId", v_booking.questions[v_booking."questionsSent" + 1], clock_timestamp(), true);
  update public."Booking" set "questionsSent" = "questionsSent" + 1, "updatedAt" = now() where id = v_booking.id;
end $$;
revoke all on function public.send_next_message_question(text) from public, anon;
grant execute on function public.send_next_message_question(text) to authenticated;
