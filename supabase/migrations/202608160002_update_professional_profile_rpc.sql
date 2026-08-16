create or replace function public.update_professional_profile(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text;
begin
  select id into v_user_id
  from public."User"
  where auth_user_id = auth.uid();

  if v_user_id is null then
    raise exception 'Usuário não encontrado';
  end if;

  update public."ProfessionalProfile"
  set headline = coalesce(p_payload->>'headline', headline),
      bio = coalesce(p_payload->>'bio', bio),
      location = coalesce(p_payload->>'location', location),
      region = coalesce(p_payload->>'region', region),
      "workMode" = coalesce(p_payload->>'workMode', "workMode"::text)::"WorkMode",
      seniority = coalesce(p_payload->>'seniority', seniority::text)::"Seniority",
      "yearsExperience" = coalesce(nullif(p_payload->>'yearsExperience', '')::integer, "yearsExperience"),
      "price30Cents" = coalesce(nullif(p_payload->>'price30Cents', '')::integer, "price30Cents"),
      "price60Cents" = coalesce(nullif(p_payload->>'price60Cents', '')::integer, "price60Cents"),
      "responseHours" = coalesce(nullif(p_payload->>'responseHours', '')::integer, "responseHours"),
      "pixKey" = nullif(p_payload->>'pixKey', ''),
      topics = string_to_array(nullif(p_payload->>'topics', ''), ', '),
      boundaries = string_to_array(nullif(p_payload->>'boundaries', ''), ', '),
      "updatedAt" = now()
  where "userId" = v_user_id;

  if not found then
    raise exception 'Perfil profissional não encontrado';
  end if;
end;
$$;

revoke all on function public.update_professional_profile(jsonb) from public;
grant execute on function public.update_professional_profile(jsonb) to authenticated;
