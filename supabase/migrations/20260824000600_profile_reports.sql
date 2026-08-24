create or replace function public.create_profile_report(p_profile_id text, p_category text, p_description text)
returns void language plpgsql security definer set search_path = '' as $$
declare reporter text; target text;
begin
  select id into reporter from public."User" where auth_user_id = auth.uid();
  select "userId" into target from public."ProfessionalProfile" where id = p_profile_id and "isActive" = true;
  if reporter is null or target is null or reporter = target then raise exception 'invalid_report'; end if;
  if p_category not in ('Foto inadequada','Informação falsa','Assédio ou comportamento abusivo','Outro') then raise exception 'invalid_category'; end if;
  if length(trim(p_description)) not between 20 and 2000 then raise exception 'invalid_description'; end if;
  insert into public."Report" (id,"reporterId","targetUserId",category,description,status,"createdAt","updatedAt")
  values (gen_random_uuid()::text, reporter, target, 'Perfil · ' || trim(p_category), trim(p_description), 'OPEN', now(), now());
end;
$$;
revoke execute on function public.create_profile_report(text,text,text) from public, anon;
grant execute on function public.create_profile_report(text,text,text) to authenticated;
