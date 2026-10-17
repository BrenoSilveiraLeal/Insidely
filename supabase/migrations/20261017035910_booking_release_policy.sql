-- A system release job may mark only demonstrative payments as released.
-- Real payments must pass through the server-side Stripe Transfer flow.
create or replace function public.release_eligible_bookings_system()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer := 0;
  b record;
begin
  for b in
    select bk.id, bk."customerId", pp."userId" as consultant_user_id
    from public."Booking" bk
    join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
    join public."Payment" pay on pay."bookingId" = bk.id
    where bk.status in ('AWAITING_CONFIRMATION'::public."BookingStatus", 'COMPLETED_RELEASE_PENDING'::public."BookingStatus")
      and bk."disputedAt" is null
      and pay.provider = 'SIMULATION'
      and pay.status in ('HELD'::public."PaymentStatus", 'PAID_HELD'::public."PaymentStatus")
      and coalesce(bk."autoReleaseAt", bk."startsAt" + ((bk."durationMinutes" + 1440) * interval '1 minute')) <= now()
    for update of bk skip locked
  loop
    update public."Booking"
      set status = 'COMPLETED'::public."BookingStatus", "updatedAt" = now()
      where id = b.id;
    update public."Payment"
      set status = 'RELEASED'::public."PaymentStatus", "releasedAt" = now(), "updatedAt" = now()
      where "bookingId" = b.id and provider = 'SIMULATION'
        and status in ('HELD'::public."PaymentStatus", 'PAID_HELD'::public."PaymentStatus");
    insert into public."Notification" ("id", "userId", title, body, href, "createdAt") values
      (extensions.gen_random_uuid()::text, b.consultant_user_id, 'Repasse demonstrativo liberado', 'As confirmações não foram concluídas e o prazo de segurança de 24 horas após o fim previsto terminou sem contestação. A simulação foi concluída.', '/consultor/ganhos', now()),
      (extensions.gen_random_uuid()::text, b."customerId", 'Conversa concluída', 'O prazo de segurança de 24 horas após o fim previsto terminou sem contestação. A simulação foi concluída.', '/dashboard/avaliacoes', now());
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.release_eligible_bookings_system() from public, anon, authenticated;
grant execute on function public.release_eligible_bookings_system() to service_role;

-- Authenticated dashboard reads may settle demonstration payments after the same deadline.
-- Never use this user-facing helper to release a real provider balance.
create or replace function public.release_eligible_bookings_for_user()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_user_id text;
  v_count integer := 0;
  b record;
begin
  select id into v_user_id from public."User" where "auth_user_id" = v_uid;
  if v_user_id is null then raise exception 'not_authorized'; end if;
  for b in
    select bk.id, bk."customerId", pp."userId" as consultant_user_id
    from public."Booking" bk
    join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
    join public."Payment" pay on pay."bookingId" = bk.id
    where (pp."userId" = v_user_id or bk."customerId" = v_user_id)
      and bk.status in ('CONFIRMED'::public."BookingStatus", 'AWAITING_CONFIRMATION'::public."BookingStatus", 'COMPLETED_RELEASE_PENDING'::public."BookingStatus")
      and bk."disputedAt" is null
      and pay.provider = 'SIMULATION'
      and pay.status in ('HELD'::public."PaymentStatus", 'PAID_HELD'::public."PaymentStatus")
      and coalesce(bk."autoReleaseAt", bk."startsAt" + ((bk."durationMinutes" + 1440) * interval '1 minute')) <= now()
    for update of bk skip locked
  loop
    update public."Booking" set status = 'COMPLETED'::public."BookingStatus", "updatedAt" = now() where id = b.id;
    update public."Payment" set status = 'RELEASED'::public."PaymentStatus", "releasedAt" = now(), "updatedAt" = now()
      where "bookingId" = b.id and provider = 'SIMULATION'
        and status in ('HELD'::public."PaymentStatus", 'PAID_HELD'::public."PaymentStatus");
    insert into public."Notification" ("id", "userId", title, body, href, "createdAt") values
      (extensions.gen_random_uuid()::text, b.consultant_user_id, 'Repasse demonstrativo liberado', 'O prazo de segurança de 24 horas após o fim previsto terminou sem contestação. A simulação foi concluída.', '/consultor/ganhos', now()),
      (extensions.gen_random_uuid()::text, b."customerId", 'Conversa concluída', 'O prazo de segurança de 24 horas após o fim previsto terminou sem contestação. A simulação foi concluída.', '/dashboard/avaliacoes', now());
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.release_eligible_bookings_for_user() from public, anon;
grant execute on function public.release_eligible_bookings_for_user() to authenticated;
