create or replace function public.search_public_profiles(
  p_query text default null, p_company_slug text default null,
  p_profession_slug text default null, p_work_mode text default null,
  p_location text default null, p_limit integer default 24, p_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select card.*
    from public.public_profile_cards card
    where (p_work_mode is null or card."workMode"::text = upper(p_work_mode))
      and (p_location is null or card.location ilike '%' || public.escape_like(p_location) || '%')
      and (p_query is null or concat_ws(' ',card.headline,card.bio,card.location,array_to_string(card.topics,' ')) ilike '%' || public.escape_like(p_query) || '%')
      and (p_company_slug is null or ((coalesce((card.privacy->>'searchableByCompany')::boolean, false) and coalesce((card.privacy->>'showCurrentCompany')::boolean, false)) and exists (
        select 1 from public."EmploymentExperience" ee join public."Company" c on c.id=ee."companyId"
        where ee."professionalProfileId"=card.id and c.slug=p_company_slug)))
      and (p_profession_slug is null or (coalesce((card.privacy->>'searchableByProfession')::boolean, false) and exists (
        select 1 from public."EmploymentExperience" ee join public."Profession" p on p.id=ee."professionId"
        where ee."professionalProfileId"=card.id and p.slug=p_profession_slug)))
  ), counted as (select *, count(*) over() total_count from filtered)
  select coalesce(jsonb_agg(jsonb_build_object('profile',to_jsonb(c)-'total_count','total_count',c.total_count) order by c."verificationStatus"='VERIFIED' desc,c.headline), '[]'::jsonb)
  from (select * from counted limit least(greatest(p_limit,1),50) offset greatest(p_offset,0)) c
$$;
revoke all on function public.search_public_profiles(text,text,text,text,text,integer,integer) from public, anon;
grant execute on function public.search_public_profiles(text,text,text,text,text,integer,integer) to anon, authenticated;
