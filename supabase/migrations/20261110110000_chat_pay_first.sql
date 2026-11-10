-- The customer pays first and only then writes in the chat (nothing is written before paying).
-- The consultant's 24-hour deadline counts from the customer's first message. A paid chat in which
-- the consultant never answered is refunded: 24 hours after the customer's first message, or at the
-- 72-hour limit when the customer never wrote.

-- 1) A chat request has no questions: the 4-argument create_message_booking accepts none.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.create_message_booking(text,text[],text,text[])'::regprocedure);
  if position('cardinality(v_questions) < 1 or ' in v_def) > 0 then
    v_def := replace(v_def, 'cardinality(v_questions) < 1 or ', '');
  end if;
  v_def := replace(v_def, '''Alguém quer conversar com você pelo chat. Assim que o pagamento for confirmado, a primeira mensagem chega e você tem 24 horas para responder.''',
    '''Alguém quer conversar com você pelo chat. Assim que o pagamento for confirmado, o chat abre; você tem 24 horas para responder depois da primeira mensagem do cliente.''');
  execute v_def;
end $$;

-- 2) Automatic closing with the deadline counted from the customer's first message.
create or replace function public.close_idle_message_chats()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  b record;
  v_count integer := 0;
  v_last timestamp;
  v_first_question timestamp;
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
      select min(m."createdAt") into v_first_question from public."Message" m where m."conversationId" = b.conversation_id and m."senderId" = b."customerId";
      -- Still within the deadline: 24 hours after the first question, or 72 hours when none was sent.
      if (v_first_question is not null and v_first_question >= now() - interval '24 hours')
         or (v_first_question is null and b."startsAt" >= now() - interval '72 hours') then
        continue;
      end if;
      -- Simulated payments are refunded here; real (Stripe) ones by the daily job, which needs the provider.
      if b.provider = 'SIMULATION' then
        update public."Booking" set status = 'CANCELLED'::public."BookingStatus", "updatedAt" = now() where id = b.id;
        update public."Payment" set status = 'REFUNDED'::public."PaymentStatus", "updatedAt" = now()
         where "bookingId" = b.id and status in ('HELD'::public."PaymentStatus", 'PAID_HELD'::public."PaymentStatus", 'APPROVED'::public."PaymentStatus");
        insert into public."Notification" (id, "userId", title, body, href, "createdAt") values
          (extensions.gen_random_uuid()::text, b."customerId", 'Chat encerrado: valor devolvido', case when v_first_question is null then 'O chat ficou 72 horas sem mensagens e foi encerrado. O valor integral foi devolvido.' else 'O consultor não respondeu em 24 horas. O valor integral foi devolvido e o chat foi encerrado.' end, '/conversa/' || b.id, now()),
          (extensions.gen_random_uuid()::text, b.consultant_id, 'Chat encerrado sem resposta', case when v_first_question is null then 'O cliente não escreveu no chat em 72 horas. O chat foi encerrado e o valor voltou para ele.' else 'Passaram 24 horas sem resposta sua. O cliente recebeu o valor de volta e o chat foi encerrado.' end, '/conversa/' || b.id, now());
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
