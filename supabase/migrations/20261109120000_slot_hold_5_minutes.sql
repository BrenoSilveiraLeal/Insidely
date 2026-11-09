-- Choosing a time slot now holds it for 5 minutes (replaces "the slot stays open until paid", 20261101109000).
-- create_booking marks the slot as booked at once, so it disappears from the profile for everyone else.
-- Paying inside the window keeps it; an unpaid request expires after 5 minutes and the slot reopens.
-- Message-format requests (no slot) keep the 30-minute payment window.

-- 1) create_booking holds the slot again. The slot row is already locked ("for update") and checked
--    "isBooked" = false, so two people choosing the same slot cannot both succeed.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.create_booking(text,text,integer,text[],text)'::regprocedure);
  if position('slot_hold_5_minutes' in v_def) > 0 then return; end if;
  if position('insert into public."Booking" (' in v_def) = 0 then raise exception 'create_booking insert not found'; end if;
  v_def := regexp_replace(v_def, 'insert into public\."Booking" \(',
    E'-- slot_hold_5_minutes: the slot is held until the request is paid or expires (5 min).\n  update public."Availability" set "isBooked" = true where id = p_slot_id and "isBooked" = false;\n  if not found then raise exception ''slot_unavailable''; end if;\n  insert into public."Booking" (');
  execute v_def;
end $$;

-- 2) Requests with a slot expire 5 minutes after being made; message requests keep 30 minutes.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.expire_past_unpaid_bookings()'::regprocedure);
  if position('slot_hold_5_minutes' in v_def) > 0 then return; end if;
  if position('bk."createdAt" < now() - interval ''30 minutes''' in v_def) = 0 then raise exception 'expire_past_unpaid_bookings window not found'; end if;
  v_def := replace(v_def, 'bk."createdAt" < now() - interval ''30 minutes''',
    'bk."createdAt" < now() - case when bk."availabilityId" is null then interval ''30 minutes'' else interval ''5 minutes'' end /* slot_hold_5_minutes */');
  v_def := replace(v_def, 'em até 30 minutos', 'no prazo');
  execute v_def;
end $$;

-- 3) Paying: the booking's own hold is not "taken by someone else". Refuse when another paid booking
--    holds the slot, or when the hold lapsed and the slot is now held by someone else.
create or replace function public.take_slot_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_booked boolean;
  v_own_hold boolean;
begin
  if new."availabilityId" is not null and public.booking_holds_slot(new.status)
     and (old.status is null or not public.booking_holds_slot(old.status)) then
    select "isBooked" into v_booked from public."Availability" where id = new."availabilityId" for update;
    if exists (select 1 from public."Booking" b where b."availabilityId" = new."availabilityId" and b.id <> new.id and public.booking_holds_slot(b.status)) then
      raise exception 'slot_taken';
    end if;
    v_own_hold := old.status = 'PENDING_PAYMENT'::public."BookingStatus" and new."createdAt" > now() - interval '5 minutes';
    if coalesce(v_booked, false) and not v_own_hold then
      raise exception 'slot_taken';
    end if;
    update public."Availability" set "isBooked" = true where id = new."availabilityId";
  end if;
  return new;
end $$;

-- 4) Expire every minute so held slots come back even when nobody opens the app (needs pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-unpaid-bookings';
    perform cron.schedule('expire-unpaid-bookings', '* * * * *', 'select public.expire_past_unpaid_bookings()');
  end if;
exception when others then
  raise notice 'pg_cron job not scheduled: %', sqlerrm;
end $$;
