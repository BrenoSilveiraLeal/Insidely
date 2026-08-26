create or replace function public.create_review(p_booking_id text, p_rating integer, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user text;
  v_booking public."Booking";
begin
  select id into v_user from public."User" where "auth_user_id" = auth.uid();
  if v_user is null or p_rating not between 1 and 5 or length(trim(p_comment)) < 12 then
    raise exception 'invalid_request';
  end if;
  select * into v_booking from public."Booking"
    where id = p_booking_id and "customerId" = v_user and status = 'COMPLETED'::public."BookingStatus";
  if v_booking.id is null or exists (select 1 from public."Review" where "bookingId" = p_booking_id) then
    raise exception 'not_reviewable';
  end if;
  insert into public."Review" (id, "bookingId", "userId", "professionalProfileId", rating, clarity, usefulness, contextualization, comment, "createdAt")
  values (extensions.gen_random_uuid()::text, v_booking.id, v_user, v_booking."professionalProfileId", p_rating, p_rating, p_rating, p_rating, trim(p_comment), now());
end;
$function$;

revoke all on function public.create_review(text, integer, text) from public, anon;
grant execute on function public.create_review(text, integer, text) to authenticated;
