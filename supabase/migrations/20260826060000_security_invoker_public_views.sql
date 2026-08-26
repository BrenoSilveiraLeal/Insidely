-- Public views must evaluate permissions and RLS as the querying role.
alter view public.public_profile_cards set (security_invoker = true);
alter view public.home_metrics set (security_invoker = true);
alter view public.public_profession_cards set (security_invoker = true);
alter view public.public_company_cards set (security_invoker = true);
alter view public.public_company_details set (security_invoker = true);
alter view public.public_profession_details set (security_invoker = true);
