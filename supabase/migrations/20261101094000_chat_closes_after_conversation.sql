-- The booking chat closes when the conversation ends: messages only while the booking is CONFIRMED
-- and its booked time has not finished (completed, cancelled, expired or past chats are read-only).
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.send_message(text,text)'::regprocedure);
  v_def := replace(v_def,
    $old$v_booking.status not in ('CONFIRMED', 'AWAITING_CONFIRMATION') or now() > v_booking."startsAt" + interval '7 days'$old$,
    $new$v_booking.status <> 'CONFIRMED' or now() > v_booking."startsAt" + make_interval(mins => v_booking."durationMinutes")$new$);
  if v_def !~ 'make_interval\(mins => v_booking."durationMinutes"\)' then raise exception 'send_message rule not found'; end if;
  execute v_def;
end $$;
