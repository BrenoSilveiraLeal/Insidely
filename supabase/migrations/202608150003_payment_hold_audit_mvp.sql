alter type public."PaymentStatus" add value if not exists 'PAYMENT_REPORTED';
alter type public."PaymentStatus" add value if not exists 'PAID_HELD';
alter type public."BookingStatus" add value if not exists 'IN_PROGRESS';
alter type public."BookingStatus" add value if not exists 'COMPLETED_RELEASE_PENDING';

alter table public."Booking"
  add column if not exists "paymentReportedAt" timestamptz,
  add column if not exists "paymentConfirmedAt" timestamptz,
  add column if not exists "paymentRejectedAt" timestamptz,
  add column if not exists "disputeReason" text,
  add column if not exists "releaseEligibleAt" timestamptz;

create table if not exists public."PaymentAuditEvent" (
  id uuid primary key default gen_random_uuid(),
  "bookingId" text not null references public."Booking"(id) on delete cascade,
  "paymentId" text references public."Payment"(id) on delete set null,
  "actorUserId" text references public."User"(id) on delete set null,
  "actorAuthId" uuid,
  "previousBookingStatus" public."BookingStatus",
  "newBookingStatus" public."BookingStatus",
  "previousPaymentStatus" public."PaymentStatus",
  "newPaymentStatus" public."PaymentStatus",
  observation text not null default '',
  "createdAt" timestamptz not null default now()
);

create index if not exists payment_audit_booking_created_idx
  on public."PaymentAuditEvent" ("bookingId", "createdAt" desc);

alter table public."PaymentAuditEvent" enable row level security;

drop policy if exists "payment audit participants read" on public."PaymentAuditEvent";
create policy "payment audit participants read" on public."PaymentAuditEvent"
for select to authenticated
using (
  exists (
    select 1 from public."Booking" b
    join public."User" u on u."auth_user_id" = (select auth.uid())
    where b.id = "PaymentAuditEvent"."bookingId"
      and (b."customerId" = u.id or exists (
        select 1 from public."ProfessionalProfile" pp
        where pp.id = b."professionalProfileId" and pp."userId" = u.id
      ) or u.role = 'ADMIN'::public."Role")
  )
);

create or replace function public.report_booking_payment(p_booking_id text, p_method text default 'PIX')
returns public."PaymentStatus"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth uuid := auth.uid();
  v_user public."User";
  v_booking public."Booking";
  v_payment public."Payment";
  v_next public."PaymentStatus" := 'PAYMENT_REPORTED'::public."PaymentStatus";
begin
  if v_auth is null then raise exception 'not_authenticated'; end if;
  select * into v_user from public."User" where "auth_user_id" = v_auth;
  select * into v_booking from public."Booking" where id = p_booking_id for update;
  if v_user.id is null or v_booking."customerId" <> v_user.id then raise exception 'not_authorized'; end if;
  if v_booking.status <> 'PENDING_PAYMENT'::public."BookingStatus" then raise exception 'invalid_booking_state'; end if;
  select * into v_payment from public."Payment" where "bookingId" = p_booking_id for update;
  if v_payment.id is null then raise exception 'payment_not_found'; end if;
  if v_payment.status <> 'PENDING'::public."PaymentStatus" then return v_payment.status; end if;
  update public."Payment" set status = v_next, provider = coalesce(nullif(p_method,''),'PIX'), "updatedAt" = now() where id = v_payment.id;
  update public."Booking" set "paymentReportedAt" = now(), "updatedAt" = now() where id = p_booking_id;
  insert into public."PaymentAuditEvent" ("bookingId","paymentId","actorUserId","actorAuthId","previousBookingStatus","newBookingStatus","previousPaymentStatus","newPaymentStatus",observation)
  values (p_booking_id,v_payment.id,v_user.id,v_auth,v_booking.status,v_booking.status,v_payment.status,v_next,'Pagamento informado pelo cliente');
  return v_next;
end;
$$;

revoke all on function public.report_booking_payment(text,text) from public;
grant execute on function public.report_booking_payment(text,text) to authenticated;
