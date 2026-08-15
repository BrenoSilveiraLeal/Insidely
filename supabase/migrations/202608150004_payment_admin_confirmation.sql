create or replace function public.admin_confirm_booking_payment(p_booking_id text, p_observation text default '')
returns public."PaymentStatus"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
  v_admin public."User";
  v_booking public."Booking";
  v_payment public."Payment";
  v_next public."PaymentStatus" := 'PAID_HELD'::public."PaymentStatus";
begin
  select * into v_admin from public."User" where "auth_user_id" = v_auth and role = 'ADMIN'::public."Role";
  if v_admin.id is null then raise exception 'not_authorized'; end if;
  select * into v_booking from public."Booking" where id = p_booking_id for update;
  select * into v_payment from public."Payment" where "bookingId" = p_booking_id for update;
  if v_booking.id is null or v_payment.id is null then raise exception 'booking_or_payment_not_found'; end if;
  if v_payment.status = v_next then return v_next; end if;
  if v_payment.status <> 'PAYMENT_REPORTED'::public."PaymentStatus" then raise exception 'invalid_payment_state'; end if;
  update public."Payment" set status = v_next, "paidAt" = now(), "updatedAt" = now() where id = v_payment.id;
  update public."Booking" set status = 'CONFIRMED'::public."BookingStatus", "paymentConfirmedAt" = now(), "updatedAt" = now() where id = p_booking_id;
  insert into public."PaymentAuditEvent" ("bookingId","paymentId","actorUserId","actorAuthId","previousBookingStatus","newBookingStatus","previousPaymentStatus","newPaymentStatus",observation)
  values (p_booking_id,v_payment.id,v_admin.id,v_auth,v_booking.status,'CONFIRMED'::public."BookingStatus",v_payment.status,v_next,coalesce(nullif(p_observation,''),'Pagamento confirmado pela administração'));
  return v_next;
end;
$$;

revoke all on function public.admin_confirm_booking_payment(text,text) from public;
grant execute on function public.admin_confirm_booking_payment(text,text) to authenticated;
