alter type public."PaymentStatus" add value if not exists 'TRANSFER_PROCESSING';
alter type public."PaymentStatus" add value if not exists 'TRANSFER_FAILED';

create table if not exists public."TransferAttempt" (
  id text primary key,
  "paymentId" text not null references public."Payment"(id) on delete cascade,
  "bookingId" text not null references public."Booking"(id) on delete cascade,
  "stripeTransferId" text,
  "idempotencyKey" text not null,
  status text not null check (status in ('PENDING','PROCESSING','SUCCEEDED','FAILED')),
  "attemptCount" integer not null default 1,
  "lastError" text,
  "nextRetryAt" timestamp with time zone,
  "createdAt" timestamp with time zone not null default now(),
  "updatedAt" timestamp with time zone not null default now()
);

create index if not exists transfer_attempt_booking_idx on public."TransferAttempt" ("bookingId", "createdAt" desc);
create index if not exists transfer_attempt_retry_idx on public."TransferAttempt" (status, "nextRetryAt");
create unique index if not exists transfer_attempt_idempotency_key_key on public."TransferAttempt" ("idempotencyKey");

alter table public."TransferAttempt" enable row level security;
revoke all on table public."TransferAttempt" from anon, authenticated;

create or replace function public.confirm_booking(p_booking_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
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
    update public."Booking" set status = 'COMPLETED_RELEASE_PENDING', "updatedAt" = now() where id = p_booking_id;
  end if;
end
$function$;
