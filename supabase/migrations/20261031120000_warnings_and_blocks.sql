-- Warnings before suspension, and blocking a specific person.

-- Formal warnings recorded by admins: 1st warning, then suspension, then ban (the admin page
-- suggests the next step from this history).
create table if not exists public."AccountWarning" (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null references public."User"(id) on delete cascade,
  "adminUserId" text not null references public."User"(id),
  reason text not null check (length(reason) between 10 and 500),
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists account_warning_user_idx on public."AccountWarning" ("userId", "createdAt" desc);
alter table public."AccountWarning" enable row level security;
revoke all on public."AccountWarning" from public, anon, authenticated;

-- A person can block another: neither of them can book a conversation with the other afterwards.
create table if not exists public."UserBlock" (
  "blockerId" text not null references public."User"(id) on delete cascade,
  "blockedId" text not null references public."User"(id) on delete cascade,
  "createdAt" timestamp(3) without time zone not null default now(),
  primary key ("blockerId", "blockedId"),
  check ("blockerId" <> "blockedId")
);
create index if not exists user_block_blocked_idx on public."UserBlock" ("blockedId");
alter table public."UserBlock" enable row level security;
revoke all on public."UserBlock" from public, anon, authenticated;

create or replace function public.require_customer_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_consultant text;
begin
  select "userId" into v_consultant from public."ProfessionalProfile" where id = new."professionalProfileId";
  if not exists (select 1 from public."CustomerIdentity" where "userId" = new."customerId") then raise exception 'identity_required'; end if;
  if v_consultant is null or not exists (select 1 from public."CustomerIdentity" where "userId" = v_consultant) then raise exception 'consultant_identity_required'; end if;
  if public.is_user_suspended(new."customerId") or public.is_user_suspended(v_consultant) then raise exception 'account_suspended'; end if;
  if exists (select 1 from public."UserBlock" where ("blockerId" = new."customerId" and "blockedId" = v_consultant) or ("blockerId" = v_consultant and "blockedId" = new."customerId")) then raise exception 'blocked'; end if;
  return new;
end $$;
revoke all on function public.require_customer_identity() from public, anon, authenticated;
