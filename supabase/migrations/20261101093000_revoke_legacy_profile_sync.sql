-- Legacy profile sync RPCs: unused by the app (provisioning runs server-side) and sync_google_profile
-- fails db lint (ON CONFLICT without a matching constraint). Nobody needs to call them.
revoke execute on function public.sync_google_profile(text, text) from authenticated, anon, public;
revoke execute on function public.sync_social_profile(text, text) from authenticated, anon, public;
