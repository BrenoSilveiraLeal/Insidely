-- Trust and safety: account suspension, audited access to the full CPF, room attendance and an
-- internal rating of customers by consultants.

-- 1. Suspension. Stays on the User row, so it survives deleting the account and coming back with the
--    same CPF (20261029170000 reactivates that same row). "suspendedUntil" null means permanent.
alter table public."User" add column if not exists "suspendedAt" timestamp(3) without time zone;
alter table public."User" add column if not exists "suspendedUntil" timestamp(3) without time zone;
alter table public."User" add column if not exists "suspensionReason" text;

create or replace function public.is_user_suspended(p_user_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public."User" where id = p_user_id and "suspendedAt" is not null and ("suspendedUntil" is null or "suspendedUntil" > now()));
$$;
revoke all on function public.is_user_suspended(text) from public, anon, authenticated;

create or replace function public.require_customer_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_consultant text;
begin
  select "userId" into v_consultant from public."ProfessionalProfile" where id = new."professionalProfileId";
  if not exists (select 1 from public."CustomerIdentity" where "userId" = new."customerId") then raise exception 'identity_required'; end if;
  if v_consultant is null or not exists (select 1 from public."CustomerIdentity" where "userId" = v_consultant) then raise exception 'consultant_identity_required'; end if;
  if public.is_user_suspended(new."customerId") or public.is_user_suspended(v_consultant) then raise exception 'account_suspended'; end if;
  return new;
end $$;
revoke all on function public.require_customer_identity() from public, anon, authenticated;

create or replace function public.refuse_suspended_sender()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_user_suspended(new."senderId") then raise exception 'account_suspended'; end if;
  return new;
end $$;
revoke all on function public.refuse_suspended_sender() from public, anon, authenticated;
drop trigger if exists message_refuses_suspended_sender on public."Message";
create trigger message_refuses_suspended_sender before insert on public."Message"
  for each row execute function public.refuse_suspended_sender();

-- 2. Every time an admin reveals someone's full CPF, who, when and why is recorded.
create table if not exists public."IdentityAccessAudit" (
  id text primary key default gen_random_uuid()::text,
  "adminUserId" text not null references public."User"(id),
  "targetUserId" text not null references public."User"(id),
  reason text not null check (length(reason) between 15 and 500),
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists identity_access_target_idx on public."IdentityAccessAudit" ("targetUserId", "createdAt" desc);
alter table public."IdentityAccessAudit" enable row level security;
revoke all on public."IdentityAccessAudit" from public, anon, authenticated;

-- 3. Attendance: who opened the room through /sala, and the participant summary Google Meet
--    reports once the room is closed. Evidence for disputes such as "the consultant did not show up".
create table if not exists public."RoomAttendance" (
  "bookingId" text not null references public."Booking"(id) on delete cascade,
  "userId" text not null references public."User"(id),
  "firstEnteredAt" timestamp(3) without time zone not null default now(),
  "lastEnteredAt" timestamp(3) without time zone not null default now(),
  entries integer not null default 1,
  primary key ("bookingId", "userId")
);
alter table public."RoomAttendance" enable row level security;
revoke all on public."RoomAttendance" from public, anon, authenticated;
alter table public."Booking" add column if not exists "meetingParticipants" jsonb;
alter table public."Booking" add column if not exists "noShowCheckedAt" timestamp(3) without time zone;

-- 4. Consultants rate the customer after the conversation. Only the team sees it.
create table if not exists public."CustomerFeedback" (
  "bookingId" text primary key references public."Booking"(id) on delete cascade,
  "consultantUserId" text not null references public."User"(id),
  "customerId" text not null references public."User"(id),
  rating integer not null check (rating between 0 and 5),
  comment text check (length(comment) <= 1000),
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists customer_feedback_customer_idx on public."CustomerFeedback" ("customerId");
alter table public."CustomerFeedback" enable row level security;
revoke all on public."CustomerFeedback" from public, anon, authenticated;
