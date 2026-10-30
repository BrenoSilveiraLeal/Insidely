-- Agenda and conversation batch.

-- Pause / vacation: the profile leaves search and cannot be booked until "pausedUntil" (null means
-- until the consultant comes back). The 5-minute job reactivates expired pauses.
alter table public."ProfessionalProfile" add column if not exists "pausedAt" timestamp(3) without time zone;
alter table public."ProfessionalProfile" add column if not exists "pausedUntil" timestamp(3) without time zone;
-- Sent by the platform on the consultant's behalf when a payment is confirmed.
alter table public."ProfessionalProfile" add column if not exists "welcomeMessage" text check ("welcomeMessage" is null or length("welcomeMessage") <= 600);

create or replace function public.require_customer_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_consultant text; v_paused timestamp; v_paused_until timestamp;
begin
  select "userId", "pausedAt", "pausedUntil" into v_consultant, v_paused, v_paused_until from public."ProfessionalProfile" where id = new."professionalProfileId";
  if not exists (select 1 from public."CustomerIdentity" where "userId" = new."customerId") then raise exception 'identity_required'; end if;
  if v_consultant is null or not exists (select 1 from public."CustomerIdentity" where "userId" = v_consultant) then raise exception 'consultant_identity_required'; end if;
  if public.is_user_suspended(new."customerId") or public.is_user_suspended(v_consultant) then raise exception 'account_suspended'; end if;
  if exists (select 1 from public."UserBlock" where ("blockerId" = new."customerId" and "blockedId" = v_consultant) or ("blockerId" = v_consultant and "blockedId" = new."customerId")) then raise exception 'blocked'; end if;
  if v_paused is not null and (v_paused_until is null or v_paused_until > now()) then raise exception 'consultant_paused'; end if;
  return new;
end $$;
revoke all on function public.require_customer_identity() from public, anon, authenticated;

-- "Avise-me quando abrir horário".
create table if not exists public."AvailabilityWatch" (
  "userId" text not null references public."User"(id) on delete cascade,
  "professionalProfileId" text not null references public."ProfessionalProfile"(id) on delete cascade,
  "createdAt" timestamp(3) without time zone not null default now(),
  primary key ("userId", "professionalProfileId")
);
alter table public."AvailabilityWatch" enable row level security;
revoke all on public."AvailabilityWatch" from public, anon, authenticated;

-- Unread-message e-mail, sent once per message.
alter table public."Message" add column if not exists "emailedAt" timestamp(3) without time zone;

-- "A conversa ajudou na sua decisão?"
create table if not exists public."ConversationSurvey" (
  "bookingId" text primary key references public."Booking"(id) on delete cascade,
  "customerId" text not null references public."User"(id) on delete cascade,
  answer text not null check (answer in ('YES', 'PARTLY', 'NO')),
  "createdAt" timestamp(3) without time zone not null default now()
);
alter table public."ConversationSurvey" enable row level security;
revoke all on public."ConversationSurvey" from public, anon, authenticated;

-- "Decidi!": what the customer decided after the conversation; published only with permission and
-- after an admin approves it.
create table if not exists public."DecisionStory" (
  "bookingId" text primary key references public."Booking"(id) on delete cascade,
  "customerId" text not null references public."User"(id) on delete cascade,
  story text not null check (length(story) between 20 and 600),
  "allowPublish" boolean not null default false,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  "createdAt" timestamp(3) without time zone not null default now()
);
alter table public."DecisionStory" enable row level security;
revoke all on public."DecisionStory" from public, anon, authenticated;
alter table public."Booking" add column if not exists "decisionPromptSentAt" timestamp(3) without time zone;
