-- Rescheduling a video conversation (customer side): the customer picks another free slot of the
-- same consultant, at least 2 hours before the current start, once per conversation. The new slot is
-- held for 30 minutes while the customer pays the reschedule fee plus any price difference
-- (30 -> 60 min, or a raised price); paying moves the conversation and frees the old slot.
-- A shorter or cheaper conversation is not offered: there is no partial refund.

create table if not exists public."BookingReschedule" (
  id text primary key default extensions.gen_random_uuid()::text,
  "bookingId" text not null references public."Booking"(id) on delete cascade,
  "customerId" text not null references public."User"(id) on delete cascade,
  "oldAvailabilityId" text,
  "oldStartsAt" timestamp without time zone not null,
  "oldDurationMinutes" integer not null,
  "newAvailabilityId" text not null references public."Availability"(id) on delete cascade,
  "newStartsAt" timestamp without time zone not null,
  "newDurationMinutes" integer not null check ("newDurationMinutes" in (30, 60)),
  "differenceCents" integer not null check ("differenceCents" >= 0),
  "feeCents" integer not null check ("feeCents" >= 0),
  "totalCents" integer not null check ("totalCents" >= 0),
  status text not null default 'PENDING_PAYMENT' check (status in ('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED')),
  "paymentMethod" text,
  "createdAt" timestamp without time zone not null default now(),
  "paidAt" timestamp without time zone
);
create index if not exists booking_reschedule_booking_idx on public."BookingReschedule" ("bookingId");
create unique index if not exists booking_reschedule_one_pending on public."BookingReschedule" ("bookingId") where status = 'PENDING_PAYMENT';

alter table public."BookingReschedule" enable row level security;
drop policy if exists booking_reschedule_customer_read on public."BookingReschedule";
create policy booking_reschedule_customer_read on public."BookingReschedule" for select to authenticated
  using ("customerId" = (select id from public."User" where "auth_user_id" = (select auth.uid())));
revoke insert, update, delete on public."BookingReschedule" from anon, authenticated;

-- Pending requests older than 30 minutes give their held slot back.
create or replace function public.expire_stale_reschedules()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare v_count integer;
begin
  with stale as (
    update public."BookingReschedule" set status = 'EXPIRED'
    where status = 'PENDING_PAYMENT' and "createdAt" < now() - interval '30 minutes'
    returning "newAvailabilityId"
  )
  update public."Availability" a set "isBooked" = false
  from stale where a.id = stale."newAvailabilityId"
    and not exists (select 1 from public."Booking" b where b."availabilityId" = a.id and b.status in ('PENDING_PAYMENT', 'CONFIRMED', 'AWAITING_CONFIRMATION', 'DISPUTED', 'COMPLETED'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.request_booking_reschedule(p_booking_id text, p_slot_id text, p_duration integer)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_customer_id text;
  v_booking public."Booking";
  v_slot public."Availability";
  v_price integer;
  v_fee integer := 500;
  v_difference integer;
  v_id text;
  v_old_pending text;
begin
  select id into v_customer_id from public."User" where "auth_user_id" = auth.uid();
  if v_customer_id is null then raise exception 'unauthorized'; end if;

  select * into v_booking from public."Booking" where id = p_booking_id for update;
  if v_booking.id is null or v_booking."customerId" <> v_customer_id then raise exception 'not_found'; end if;
  if v_booking.status <> 'CONFIRMED' or coalesce(v_booking.format, 'VIDEO') <> 'VIDEO' then raise exception 'not_reschedulable'; end if;
  if v_booking."startsAt" < now() + interval '2 hours' then raise exception 'too_late'; end if;
  if exists (select 1 from public."BookingReschedule" where "bookingId" = p_booking_id and status = 'PAID') then raise exception 'already_rescheduled'; end if;
  if p_duration not in (30, 60) or p_duration < v_booking."durationMinutes" then raise exception 'invalid_duration'; end if;

  perform public.expire_stale_reschedules();
  -- A new choice replaces an unpaid one and gives its slot back.
  update public."BookingReschedule" set status = 'CANCELLED'
  where "bookingId" = p_booking_id and status = 'PENDING_PAYMENT'
  returning "newAvailabilityId" into v_old_pending;
  if v_old_pending is not null then update public."Availability" set "isBooked" = false where id = v_old_pending; end if;

  select * into v_slot from public."Availability"
  where id = p_slot_id and "professionalProfileId" = v_booking."professionalProfileId"
    and "isBooked" = false and "startsAt" >= now() + interval '10 minutes'
  for update;
  if v_slot.id is null then raise exception 'slot_unavailable'; end if;
  if v_slot."endsAt" < v_slot."startsAt" + make_interval(mins => p_duration) then raise exception 'slot_unavailable'; end if;

  select case when p_duration = 60 then "price60Cents" else "price30Cents" end into v_price
  from public."ProfessionalProfile" where id = v_booking."professionalProfileId";
  v_difference := greatest(0, coalesce(v_price, 0) - v_booking."subtotalCents");

  update public."Availability" set "isBooked" = true where id = p_slot_id and "isBooked" = false;
  if not found then raise exception 'slot_unavailable'; end if;
  insert into public."BookingReschedule" ("bookingId", "customerId", "oldAvailabilityId", "oldStartsAt", "oldDurationMinutes", "newAvailabilityId", "newStartsAt", "newDurationMinutes", "differenceCents", "feeCents", "totalCents")
  values (p_booking_id, v_customer_id, v_booking."availabilityId", v_booking."startsAt", v_booking."durationMinutes", p_slot_id, v_slot."startsAt", p_duration, v_difference, v_fee, v_difference + v_fee)
  returning id into v_id;
  return v_id;
end;
$$;

-- Called by the server after the (simulated) payment: moves the conversation to the new slot.
create or replace function public.apply_booking_reschedule(p_reschedule_id text, p_method text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_r public."BookingReschedule";
  v_booking public."Booking";
  v_consultant_id text;
begin
  select * into v_r from public."BookingReschedule" where id = p_reschedule_id for update;
  if v_r.id is null or v_r.status <> 'PENDING_PAYMENT' then raise exception 'not_pending'; end if;
  if v_r."createdAt" < now() - interval '30 minutes' then raise exception 'expired'; end if;
  select * into v_booking from public."Booking" where id = v_r."bookingId" for update;
  if v_booking.status <> 'CONFIRMED' or v_booking."startsAt" <> v_r."oldStartsAt" then raise exception 'not_reschedulable'; end if;

  update public."BookingReschedule" set status = 'PAID', "paidAt" = now(), "paymentMethod" = p_method where id = v_r.id;
  update public."Booking" set
    "availabilityId" = v_r."newAvailabilityId", "startsAt" = v_r."newStartsAt", "durationMinutes" = v_r."newDurationMinutes",
    "subtotalCents" = "subtotalCents" + v_r."differenceCents", "feeCents" = "feeCents" + v_r."feeCents", "totalCents" = "totalCents" + v_r."totalCents",
    "reminderSentAt" = null, "updatedAt" = now()
  where id = v_booking.id;
  update public."Payment" set "amountCents" = "amountCents" + v_r."totalCents", "updatedAt" = now() where "bookingId" = v_booking.id;
  if v_r."oldAvailabilityId" is not null and v_r."oldAvailabilityId" <> v_r."newAvailabilityId" then
    update public."Availability" set "isBooked" = false where id = v_r."oldAvailabilityId";
  end if;

  select "userId" into v_consultant_id from public."ProfessionalProfile" where id = v_booking."professionalProfileId";
  insert into public."Notification" (id, "userId", title, body, href, "createdAt") values
    (extensions.gen_random_uuid()::text, v_consultant_id, 'Conversa reagendada', 'O cliente mudou o horário de uma conversa. Veja o novo horário em Consultas.', '/consultor/consultas', now()),
    (extensions.gen_random_uuid()::text, v_r."customerId", 'Conversa reagendada', 'O novo horário da sua conversa está confirmado.', '/dashboard/agendamentos', now());
  return v_booking.id;
end;
$$;

revoke all on function public.expire_stale_reschedules() from public, anon, authenticated;
revoke all on function public.apply_booking_reschedule(text, text) from public, anon, authenticated;
revoke all on function public.request_booking_reschedule(text, text, integer) from public, anon;
grant execute on function public.request_booking_reschedule(text, text, integer) to authenticated;
grant execute on function public.expire_stale_reschedules() to service_role;
grant execute on function public.apply_booking_reschedule(text, text) to service_role;
