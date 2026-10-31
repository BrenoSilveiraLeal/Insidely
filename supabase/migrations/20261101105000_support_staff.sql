-- Support staff: accounts hired by Insidely to handle support requests and reports. They work only
-- in the case queue (/admin/casos); every other admin page stays with ADMIN.
alter type public."Role" add value if not exists 'SUPPORT';

-- After a case is closed, the person who opened it rates the service (Ruim, Bom or Ótimo) and may add
-- a comment. One rating per case. Only admins read them, on the staff member's account page.
create table if not exists public."SupportRating" (
  id text primary key default gen_random_uuid()::text,
  "reportId" text not null unique references public."Report"(id) on delete cascade,
  "raterId" text references public."User"(id) on delete set null,
  "staffUserId" text references public."User"(id) on delete set null,
  rating text not null check (rating in ('RUIM', 'BOM', 'OTIMO')),
  comment text check (char_length(comment) <= 1000),
  "createdAt" timestamp(3) without time zone not null default now()
);
create index if not exists "SupportRating_staffUserId_idx" on public."SupportRating" ("staffUserId", "createdAt" desc);
alter table public."SupportRating" enable row level security;
revoke all on public."SupportRating" from public, anon, authenticated;

-- New support requests and reports also reach the support staff's bell (admins are already notified
-- by the functions that create them). Compared as text: the new enum value cannot be used as a
-- literal in the same transaction that adds it.
create or replace function public.notify_support_staff_of_report()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public."Notification" (id, "userId", title, body, href, "createdAt")
  select gen_random_uuid()::text, u.id,
         case when new."targetUserId" is null and new."bookingId" is null then 'Novo pedido de suporte' else 'Nova denúncia' end,
         left(new.category, 140), '/admin/casos', now()
    from public."User" u
   where u.role::text = 'SUPPORT' and u.auth_user_id is not null;
  return new;
end $$;

revoke all on function public.notify_support_staff_of_report() from public, anon, authenticated;

drop trigger if exists notify_support_staff_of_report on public."Report";
create trigger notify_support_staff_of_report after insert on public."Report" for each row execute function public.notify_support_staff_of_report();
