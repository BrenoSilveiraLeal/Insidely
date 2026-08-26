-- Public projection views intentionally enforce their limited SELECT list with
-- SECURITY DEFINER because their base tables are not exposed to anonymous users.
alter view public.public_profile_cards reset (security_invoker);
alter view public.home_metrics reset (security_invoker);
alter view public.public_profession_cards reset (security_invoker);
alter view public.public_company_cards reset (security_invoker);
alter view public.public_company_details reset (security_invoker);
alter view public.public_profession_details reset (security_invoker);
