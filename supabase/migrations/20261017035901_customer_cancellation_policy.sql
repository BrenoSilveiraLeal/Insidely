-- Apply a 10% late-cancellation fee to customer cancellations within 24 hours.
-- Stripe refunds are issued by the server action before this transaction runs.
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
  v_payment public."Payment";
  v_paid boolean := false;
  v_fee integer := 0;
  v_refund integer := 0;
  v_now timestamptz := now();
  v_customer_message text;
begin
  select id into v_user from public."User" where "auth_user_id" = auth.uid();
  if v_user is null then raise exception 'not_authorized'; end if;
  select * into v_booking from public."Booking" where id = p_booking_id and "customerId" = v_user for update;
  if v_booking.id is null then raise exception 'not_authorized'; end if;
  if v_booking.status not in ('PENDING_PAYMENT'::public."BookingStatus", 'CONFIRMED'::public."BookingStatus") then raise exception 'invalid_state'; end if;
  if v_booking."startsAt" <= v_now then raise exception 'already_started'; end if;

  select * into v_payment from public."Payment" where "bookingId" = p_booking_id for update;
  v_paid := coalesce(v_payment.status::text in ('PAID_HELD', 'HELD', 'APPROVED'), false);
  if v_paid then
    if v_booking."startsAt" <= v_now + interval '24 hours' then
      v_fee := round(v_payment."amountCents" * 0.10)::integer;
    end if;
    v_refund := v_payment."amountCents" - v_fee;
    update public."Payment" set status = 'REFUNDED'::public."PaymentStatus", "updatedAt" = v_now where id = v_payment.id;
    v_customer_message := case when v_fee > 0
      then format('Reserva cancelada. R$ %s foram devolvidos ao meio de pagamento utilizado; R$ %s correspondem à taxa de cancelamento (10%%) por estar dentro de 24 horas do início.', to_char(v_refund / 100.0, 'FM999999990D00'), to_char(v_fee / 100.0, 'FM999999990D00'))
      else 'Reserva cancelada. O valor integral será devolvido ao meio de pagamento utilizado.' end;
  else
    update public."Payment" set status = 'FAILED'::public."PaymentStatus", "updatedAt" = v_now where "bookingId" = p_booking_id and status = 'PENDING'::public."PaymentStatus";
    v_customer_message := 'Seu pedido foi cancelado sem cobrança.';
  end if;

  update public."Booking" set status = 'CANCELLED'::public."BookingStatus", "updatedAt" = v_now where id = p_booking_id;
  update public."Availability" set "isBooked" = false where id = v_booking."availabilityId";
  select "userId" into v_consultant from public."ProfessionalProfile" where id = v_booking."professionalProfileId";
  insert into public."Notification" (id, "userId", title, body, href, "createdAt") values
    (extensions.gen_random_uuid()::text, v_consultant, 'Conversa cancelada pelo cliente',
     'O cliente cancelou a conversa e o horário voltou a ficar disponível.' || case when nullif(trim(coalesce(p_reason, '')), '') is not null then ' Motivo: ' || left(trim(p_reason), 300) else '' end,
     '/consultor/consultas', v_now),
    (extensions.gen_random_uuid()::text, v_user, 'Reserva cancelada', v_customer_message, '/dashboard/agendamentos', v_now);
end;
$function$;

revoke all on function public.customer_cancel_booking(text, text) from public, anon;
grant execute on function public.customer_cancel_booking(text, text) to authenticated;
