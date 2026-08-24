create or replace function public.release_eligible_bookings_system()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  b record;
  v_consultant_user_id text;
begin
  for b in
    select bk.id, bk."customerId", pp."userId" as consultant_user_id
    from public."Booking" bk
    join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
    join public."Payment" pay on pay."bookingId" = bk.id
    where bk.status = 'AWAITING_CONFIRMATION'::public."BookingStatus"
      and bk."disputedAt" is null
      and pay.status in ('HELD'::public."PaymentStatus", 'PAID_HELD'::public."PaymentStatus")
      and coalesce(bk."autoReleaseAt", bk."startsAt" + ((bk."durationMinutes" + 1440) * interval '1 minute')) <= now()
    for update of bk
  loop
    v_consultant_user_id := b.consultant_user_id;
    update public."Booking" set status = 'COMPLETED'::public."BookingStatus", "updatedAt" = now() where id = b.id;
    update public."Payment" set status = 'RELEASED'::public."PaymentStatus", "releasedAt" = now(), "updatedAt" = now() where "bookingId" = b.id;
    insert into public."Notification" ("id", "userId", title, body, href, "createdAt") values
      (gen_random_uuid()::text, v_consultant_user_id, 'Repasse liberado', 'O prazo de confirmação terminou sem contestação. O repasse demonstrativo foi liberado.', '/consultor/ganhos', now()),
      (gen_random_uuid()::text, b."customerId", 'Conversa concluída', 'O prazo de confirmação terminou sem contestação.', '/dashboard/avaliacoes', now());
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.release_eligible_bookings_system() from public;
grant execute on function public.release_eligible_bookings_system() to service_role;
