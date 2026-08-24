-- The booking transaction needs to read and write protected tables atomically.
-- Keep the function callable only by authenticated users; it validates the
-- caller's USER/ADMIN profile before doing any work.
alter function public.create_booking(text, text, integer, text[], text)
  security definer
  set search_path = public, auth, extensions;

revoke execute on function public.create_booking(text, text, integer, text[], text) from public, anon;
grant execute on function public.create_booking(text, text, integer, text[], text) to authenticated;
