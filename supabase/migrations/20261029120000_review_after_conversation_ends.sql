-- Reviews open as soon as the scheduled conversation ends, instead of waiting for both
-- confirmations and the payment release. Ratings go from 0 to 5 and the comment is optional.
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
  if v_user is null or p_rating is null or p_rating not between 0 and 5 or length(coalesce(p_comment, '')) > 2000 then
    raise exception 'invalid_request';
  end if;
  select * into v_booking from public."Booking"
    where id = p_booking_id and "customerId" = v_user
      and status in ('CONFIRMED'::public."BookingStatus", 'AWAITING_CONFIRMATION'::public."BookingStatus", 'COMPLETED_RELEASE_PENDING'::public."BookingStatus", 'COMPLETED'::public."BookingStatus")
      and "disputedAt" is null
      and "startsAt" + ("durationMinutes" * interval '1 minute') <= now();
  if v_booking.id is null or exists (select 1 from public."Review" where "bookingId" = p_booking_id) then
    raise exception 'not_reviewable';
  end if;
  if exists (select 1 from public."ProfessionalProfile" where id = v_booking."professionalProfileId" and "userId" = v_user) then
    raise exception 'self_review';
  end if;
  insert into public."Review" (id, "bookingId", "userId", "professionalProfileId", rating, clarity, usefulness, contextualization, comment, "createdAt")
  values (extensions.gen_random_uuid()::text, v_booking.id, v_user, v_booking."professionalProfileId", p_rating, p_rating, p_rating, p_rating, nullif(trim(coalesce(p_comment, '')), ''), now());
end;
$function$;

revoke all on function public.create_review(text, integer, text) from public, anon;
grant execute on function public.create_review(text, integer, text) to authenticated;

-- One "rate your conversation" prompt per booking, claimed by /api/cron/reminders.
alter table public."Booking" add column if not exists "reviewPromptSentAt" timestamp(3) without time zone;
