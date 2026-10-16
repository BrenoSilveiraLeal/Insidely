-- Customers had no way to cancel: only the consultant could. Allow the customer to cancel a request
-- or a confirmed conversation before it starts. Simulated payments are marked as refunded, the slot is
-- released and the consultant is notified.
create or replace function public.customer_cancel_booking(p_booking_id text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user text;
  v_booking public."Booking";
  v_consultant text;
  v_provider text;
begin
  select id into v_user from public."User" where auth_user_id = auth.uid();
  if v_user is null then raise exception 'not_authorized'; end if;
  select * into v_booking from public."Booking" where id = p_booking_id and "customerId" = v_user for update;
  if v_booking.id is null then raise exception 'not_authorized'; end if;
  if v_booking.status not in ('PENDING_PAYMENT'::public."BookingStatus", 'CONFIRMED'::public."BookingStatus") then raise exception 'invalid_state'; end if;
  if v_booking."startsAt" <= (now() at time zone 'utc') then raise exception 'already_started'; end if;
  select provider into v_provider from public."Payment" where "bookingId" = p_booking_id;
  if v_booking.status = 'CONFIRMED'::public."BookingStatus" and coalesce(v_provider, '') <> 'SIMULATION' then raise exception 'refund_requires_support'; end if;

  update public."Booking" set status = 'CANCELLED'::public."BookingStatus", "updatedAt" = now() where id = p_booking_id;
  update public."Payment" set status = case when status = 'PAID_HELD'::public."PaymentStatus" then 'REFUNDED'::public."PaymentStatus" else 'FAILED'::public."PaymentStatus" end, "updatedAt" = now()
    where "bookingId" = p_booking_id and status in ('PENDING'::public."PaymentStatus", 'PAID_HELD'::public."PaymentStatus");
  update public."Availability" set "isBooked" = false where id = v_booking."availabilityId";

  select "userId" into v_consultant from public."ProfessionalProfile" where id = v_booking."professionalProfileId";
  insert into public."Notification" (id, "userId", title, body, href, "createdAt") values
    (gen_random_uuid()::text, v_consultant, 'Conversa cancelada pelo cliente',
     'O cliente cancelou a conversa e o horário voltou a ficar disponível.' || case when nullif(trim(coalesce(p_reason, '')), '') is not null then ' Motivo: ' || left(trim(p_reason), 300) else '' end,
     '/consultor/consultas', now()),
    (gen_random_uuid()::text, v_user, 'Reserva cancelada',
     case when v_booking.status = 'CONFIRMED'::public."BookingStatus" then 'Sua conversa foi cancelada e o valor (simulado) foi reembolsado.' else 'Seu pedido foi cancelado.' end,
     '/dashboard/agendamentos', now());
end;
$function$;

revoke all on function public.customer_cancel_booking(text, text) from public, anon;
grant execute on function public.customer_cancel_booking(text, text) to authenticated;
