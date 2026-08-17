-- The authenticated role must not receive direct access to ProfessionalProfile.
-- This narrowly scoped RPC validates auth.uid() and exposes only a favorite toggle.
alter function public.toggle_favorite(text) security definer;
alter function public.toggle_favorite(text) set search_path = '';

revoke all on function public.toggle_favorite(text) from public, anon;
grant execute on function public.toggle_favorite(text) to authenticated;
