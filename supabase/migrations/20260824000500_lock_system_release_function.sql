-- Cron invokes this with the service role; it must not be an API endpoint.
revoke execute on function public.release_eligible_bookings_system() from public, anon, authenticated;
grant execute on function public.release_eligible_bookings_system() to service_role;
