do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Message') then
    alter publication supabase_realtime add table public."Message";
  end if;
exception when undefined_object then
  null;
end;
$$;

create schema if not exists private;
create or replace function private.can_read_message(p_conversation_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public."Conversation" c
    join public."Booking" b on b.id = c."bookingId"
    join public."User" customer on customer.id = b."customerId"
    where c.id = p_conversation_id
      and (
        customer."auth_user_id" = (select auth.uid())
        or exists (
          select 1 from public."ProfessionalProfile" pp
          join public."User" consultant on consultant.id = pp."userId"
          where pp.id = b."professionalProfileId" and consultant."auth_user_id" = (select auth.uid())
        )
      )
  );
$$;

revoke all on function private.can_read_message(text) from public;
grant usage on schema private to authenticated;
grant execute on function private.can_read_message(text) to authenticated;
grant select on public."Message" to authenticated;
drop policy if exists "message participants can read" on public."Message";
create policy "message participants can read" on public."Message"
for select to authenticated
using (private.can_read_message("conversationId"));
