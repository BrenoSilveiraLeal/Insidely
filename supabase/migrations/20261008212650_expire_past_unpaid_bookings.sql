create or replace function public.expire_past_unpaid_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := auth.uid();
  v_user_id text;
  v_count integer := 0;
  b record;
begin
  if v_auth is null then
    if current_setting('role', true) is distinct from 'service_role' and session_user <> 'postgres' then
      raise exception 'not_authorized';
    end if;
  else
    select id into v_user_id from public."User" where "auth_user_id" = v_auth;
    if v_user_id is null then raise exception 'not_authorized'; end if;
  end if;

  for b in
    select bk.id, bk."customerId", pp."userId" as consultant_user_id, bk."availabilityId"
    from public."Booking" bk
    join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
    join public."Payment" pay on pay."bookingId" = bk.id
    where bk.status = 'PENDING_PAYMENT'::public."BookingStatus"
      and bk."startsAt" < now()
      and pay.status in ('PENDING'::public."PaymentStatus", 'FAILED'::public."PaymentStatus")
      and (v_user_id is null or bk."customerId" = v_user_id or pp."userId" = v_user_id)
    for update of bk skip locked
  loop
    update public."Booking"
      set status = 'EXPIRED'::public."BookingStatus", "updatedAt" = now()
      where id = b.id and status = 'PENDING_PAYMENT'::public."BookingStatus";
    if not found then continue; end if;

    update public."Availability"
      set "isBooked" = false
      where id = b."availabilityId" and "isBooked" = true;

    insert into public."Notification" (id, "userId", title, body, href, "createdAt")
    values
      (gen_random_uuid()::text, b."customerId", 'Agendamento expirado', 'O pagamento não foi concluído antes do horário. O registro foi mantido no histórico e o horário liberado.', '/dashboard/agendamentos', now()),
      (gen_random_uuid()::text, b.consultant_user_id, 'Solicitação expirada', 'O pagamento não foi concluído antes do horário. O registro foi mantido no histórico e o horário liberado.', '/consultor/consultas', now());

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.expire_past_unpaid_bookings() from public, anon;
grant execute on function public.expire_past_unpaid_bookings() to authenticated, service_role;


