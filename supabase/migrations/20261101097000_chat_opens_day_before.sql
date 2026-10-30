-- The booking chat opens 24 hours before the conversation (it already closes when it ends), the
-- same rule the app applies in booking-policy.ts, so it cannot be bypassed by calling the RPC.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.send_message(text,text)'::regprocedure);
  v_def := replace(v_def,
    $old$v_booking.status <> 'CONFIRMED' or now() > v_booking."startsAt" + make_interval(mins => v_booking."durationMinutes")$old$,
    $new$v_booking.status <> 'CONFIRMED' or now() < v_booking."startsAt" - interval '24 hours' or now() > v_booking."startsAt" + make_interval(mins => v_booking."durationMinutes")$new$);
  if v_def !~ 'interval ''24 hours''' then raise exception 'send_message rule not found'; end if;
  execute v_def;
end $$;
