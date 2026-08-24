create or replace function public.sync_google_profile(p_name text, p_image text)
returns table(role text, "onboardingCompleted" boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_role public."Role";
  v_onboarding boolean;
begin
  select lower(trim(coalesce(auth.jwt() ->> 'email', au.email)))
    into v_email
  from auth.users au
  where au.id = v_uid;

  if v_uid is null or v_email is null or v_email = '' then
    raise exception 'invalid_auth_context';
  end if;

  update public."User"
  set "auth_user_id" = v_uid,
      name = coalesce(nullif(trim(p_name), ''), name),
      image = coalesce(p_image, image),
      "updatedAt" = now()
  where lower(email) = v_email;

  if not found then
    insert into public."User" (id, name, email, image, "auth_user_id", "updatedAt")
    values (gen_random_uuid()::text, coalesce(nullif(trim(p_name), ''), 'Pessoa Insidely'), v_email, p_image, v_uid, now())
    on conflict ("auth_user_id") do update
      set name = excluded.name,
          image = coalesce(excluded.image, public."User".image),
          "updatedAt" = now();
  end if;

  select u.role, u."onboardingCompleted"
    into v_role, v_onboarding
  from public."User" u
  where u."auth_user_id" = v_uid;

  if v_role is null then raise exception 'profile_sync_failed'; end if;
  return query select v_role::text, v_onboarding;
end;
$$;

create or replace function public.sync_social_profile(p_name text, p_image text)
returns table(role text, "onboardingCompleted" boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select * from public.sync_google_profile(p_name, p_image);
end;
$$;

revoke all on function public.sync_google_profile(text, text), public.sync_social_profile(text, text) from public, anon;
grant execute on function public.sync_google_profile(text, text), public.sync_social_profile(text, text) to authenticated;
