-- Leitura administrativa para a fila de moderação, sem expor dados a usuários comuns.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public."User" u
    where u."auth_user_id" = auth.uid()
      and u.role = 'ADMIN'::public."Role"
  );
$function$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

grant select on table public."Verification", public."VerificationDocument", public."Report", public."Booking", public."Payment" to authenticated;

drop policy if exists admin_read_verification on public."Verification";
create policy admin_read_verification on public."Verification" for select to authenticated using (public.is_admin());
drop policy if exists admin_read_verification_documents on public."VerificationDocument";
create policy admin_read_verification_documents on public."VerificationDocument" for select to authenticated using (public.is_admin());
drop policy if exists admin_read_reports on public."Report";
create policy admin_read_reports on public."Report" for select to authenticated using (public.is_admin());
drop policy if exists admin_read_users on public."User";
create policy admin_read_users on public."User" for select to authenticated using (public.is_admin());
drop policy if exists admin_read_bookings on public."Booking";
create policy admin_read_bookings on public."Booking" for select to authenticated using (public.is_admin());
drop policy if exists admin_read_payments on public."Payment";
create policy admin_read_payments on public."Payment" for select to authenticated using (public.is_admin());

do $block$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'admin_read_verification_documents'
  ) then
    create policy admin_read_verification_documents on storage.objects
      for select to authenticated
      using (bucket_id = 'verification-documents' and public.is_admin());
  end if;
end
$block$;
