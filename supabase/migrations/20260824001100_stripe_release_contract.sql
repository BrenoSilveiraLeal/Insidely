-- The payment remains held until the application creates the Stripe Transfer.
create or replace function public.confirm_booking(p_booking_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user text; v_booking public."Booking";
begin
  select id into v_user from public."User" where "auth_user_id" = auth.uid();
  select * into v_booking from public."Booking" where id = p_booking_id for update;
  if v_booking.id is null or v_booking.status not in ('CONFIRMED','AWAITING_CONFIRMATION') then raise exception 'invalid_state'; end if;
  if v_booking."customerId" = v_user then
    update public."Booking" set "customerConfirmedAt" = now(), status = 'AWAITING_CONFIRMATION', "updatedAt" = now() where id = p_booking_id;
  elsif exists(select 1 from public."ProfessionalProfile" where id = v_booking."professionalProfileId" and "userId" = v_user) then
    update public."Booking" set "consultantConfirmedAt" = now(), status = 'AWAITING_CONFIRMATION', "updatedAt" = now() where id = p_booking_id;
  else raise exception 'not_authorized'; end if;
  if (select "customerConfirmedAt" is not null and "consultantConfirmedAt" is not null from public."Booking" where id = p_booking_id) then
    update public."Booking" set status = 'COMPLETED', "updatedAt" = now() where id = p_booking_id;
  end if;
end $$;
revoke execute on function public.confirm_booking(text) from public, anon;
grant execute on function public.confirm_booking(text) to authenticated;
