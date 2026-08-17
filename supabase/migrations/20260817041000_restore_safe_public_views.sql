-- These projection views intentionally execute with their owner privileges.
-- They expose only curated public fields and prevent direct access to private base tables.
alter view public.home_metrics set (security_invoker = false);
alter view public.public_profile_cards set (security_invoker = false);
alter view public.public_company_cards set (security_invoker = false);
alter view public.public_profession_cards set (security_invoker = false);
alter view public.public_company_details set (security_invoker = false);
alter view public.public_profession_details set (security_invoker = false);

revoke all on public.home_metrics, public.public_profile_cards,
  public.public_company_cards, public.public_profession_cards,
  public.public_company_details, public.public_profession_details from public;
grant select on public.home_metrics, public.public_profile_cards,
  public.public_company_cards, public.public_profession_cards,
  public.public_company_details, public.public_profession_details to anon, authenticated;

-- The paginated search is also a curated public projection. Definer rights let it
-- inspect experience relationships without granting direct access to those tables.
alter function public.search_public_profiles(text,text,text,text,text,integer,integer) security definer;
revoke execute on function public.search_public_profiles(text,text,text,text,text,integer,integer) from public;
grant execute on function public.search_public_profiles(text,text,text,text,text,integer,integer) to anon, authenticated;
