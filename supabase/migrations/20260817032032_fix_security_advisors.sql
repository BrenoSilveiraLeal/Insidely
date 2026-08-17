-- Public views must evaluate permissions as the caller, not the owner.
alter view if exists public.home_metrics set (security_invoker=true);
alter view if exists public.public_profile_cards set (security_invoker=true);
alter view if exists public.public_company_cards set (security_invoker=true);
alter view if exists public.public_profession_cards set (security_invoker=true);
alter view if exists public.public_company_details set (security_invoker=true);
alter view if exists public.public_profession_details set (security_invoker=true);

-- pg_trgm is infrastructure, not an application object.
create schema if not exists extensions;
alter extension pg_trgm set schema extensions;

-- Earlier generic deny policies are redundant with RLS/default-deny and created
-- multiple permissive-policy advisor findings.
do $$
declare item record;
begin
 for item in select schemaname,tablename from pg_policies where schemaname='public' and policyname='deny_direct_access' loop
  execute format('drop policy if exists deny_direct_access on %I.%I',item.schemaname,item.tablename);
 end loop;
end $$;

drop policy if exists "audit deny client reads" on public."AccountDeletionAudit";
create policy "audit deny client reads" on public."AccountDeletionAudit" as restrictive for select to authenticated using(false);

-- PostgreSQL grants EXECUTE to PUBLIC on creation. Remove that implicit grant
-- from every security-definer application function; authenticated callers still
-- face each function's auth.uid()/ownership/admin checks.
do $$
declare fn record;
begin
 for fn in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
  execute format('revoke execute on function %s from public, anon',fn.signature);
  execute format('grant execute on function %s to authenticated',fn.signature);
 end loop;
end $$;
