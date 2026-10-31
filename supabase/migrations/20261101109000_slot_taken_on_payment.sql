-- A time slot stays open on the profile until a conversation on it is paid. Choosing a slot only
-- creates a request awaiting payment; several people may hold requests for the same slot, and the
-- first payment takes it. A later payment for that slot is refused ('slot_taken'); the application
-- then tells the person (and refunds a real charge).

-- Bookings that hold a slot: paid or past the payment step.
create or replace function public.booking_holds_slot(p_status public."BookingStatus")
returns boolean language sql immutable as $$
  select p_status in ('CONFIRMED', 'IN_PROGRESS', 'AWAITING_CONFIRMATION', 'COMPLETED_RELEASE_PENDING', 'COMPLETED', 'DISPUTED')
$$;

-- When a booking becomes paid, it takes its slot, unless the slot is already booked: by another paid
-- booking, or held by a reschedule awaiting its fee (booking_reschedule sets "isBooked" for 30 min).
create or replace function public.take_slot_on_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_booked boolean;
begin
  if new."availabilityId" is not null and public.booking_holds_slot(new.status)
     and (old.status is null or not public.booking_holds_slot(old.status)) then
    select "isBooked" into v_booked from public."Availability" where id = new."availabilityId" for update;
    if coalesce(v_booked, false)
       or exists (select 1 from public."Booking" b where b."availabilityId" = new."availabilityId" and b.id <> new.id and public.booking_holds_slot(b.status)) then
      raise exception 'slot_taken';
    end if;
    update public."Availability" set "isBooked" = true where id = new."availabilityId";
  end if;
  return new;
end $$;
drop trigger if exists booking_take_slot_on_payment on public."Booking";
create trigger booking_take_slot_on_payment before update of status on public."Booking"
  for each row execute function public.take_slot_on_payment();

-- Code that frees a slot (an expired or cancelled request) never reopens one a paid booking holds.
create or replace function public.keep_paid_slot_booked()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new."isBooked" = false and old."isBooked" = true
     and exists (select 1 from public."Booking" b where b."availabilityId" = new.id and public.booking_holds_slot(b.status)) then
    new."isBooked" := true;
  end if;
  return new;
end $$;
drop trigger if exists availability_keep_paid_slot_booked on public."Availability";
create trigger availability_keep_paid_slot_booked before update of "isBooked" on public."Availability"
  for each row execute function public.keep_paid_slot_booked();

-- create_booking no longer marks the slot as booked.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.create_booking(text,text,integer,text[],text)'::regprocedure);
  if position('update public."Availability" set "isBooked" = true where id = p_slot_id' in v_def) = 0 then return; end if;
  v_def := replace(v_def, E'  update public."Availability" set "isBooked" = true where id = p_slot_id and "isBooked" = false;\n  if not found then raise exception ''slot_unavailable''; end if;\n', '');
  if position('update public."Availability" set "isBooked" = true where id = p_slot_id' in v_def) > 0 then raise exception 'create_booking slot update not found'; end if;
  execute v_def;
end $$;

-- Slots held today only by requests awaiting payment open again.
update public."Availability" a set "isBooked" = false
 where a."isBooked" = true
   and exists (select 1 from public."Booking" b where b."availabilityId" = a.id and b.status = 'PENDING_PAYMENT')
   and not exists (select 1 from public."Booking" b where b."availabilityId" = a.id and public.booking_holds_slot(b.status));

-- Nobody books their own profile, by video or by message (it was allowed for testing).
do $$
declare v_def text; v_check text := E'if v_consultant_id is null then raise exception ''profile_not_found''; end if;';
begin
  v_def := pg_get_functiondef('public.create_booking(text,text,integer,text[],text)'::regprocedure);
  if position('own_profile' in v_def) = 0 then
    if position(v_check in v_def) = 0 then raise exception 'create_booking profile check not found'; end if;
    execute replace(v_def, v_check, v_check || E'\n  if v_consultant_id = v_customer_id then raise exception ''own_profile''; end if;');
  end if;
  v_def := pg_get_functiondef('public.create_message_booking(text, text[], text)'::regprocedure);
  if position('own_profile' in v_def) = 0 then
    if position(v_check in v_def) = 0 then raise exception 'create_message_booking profile check not found'; end if;
    execute replace(v_def, v_check, v_check || E'\n  if v_consultant_id = v_customer_id then raise exception ''own_profile''; end if;');
  end if;
end $$;
