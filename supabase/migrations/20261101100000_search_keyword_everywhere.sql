-- The keyword search now looks at everything a visitor can see about a consultant: public name,
-- headline, bio, city, topics, and every experience's job title, area, profession and company
-- (the company only when the consultant shows it and allows search by company). It ignores
-- accents and case, and a query with several words matches profiles that contain all of them
-- ("xp analista", "sao paulo"). The other filters are unchanged.
create or replace function public.search_public_profiles(p_query text default null::text, p_company_slug text default null::text, p_profession_slug text default null::text, p_work_mode text default null::text, p_location text default null::text, p_limit integer default 24, p_offset integer default 0)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  with words as (
    select array_remove(regexp_split_to_array(lower(translate(trim(coalesce(p_query, '')), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')), '\s+'), '') as list
  ), cards as (
    select card.*,
      lower(translate(concat_ws(' ',
        card."user"->>'name', card.pseudonym, card.headline, card.bio, card.location, array_to_string(card.topics, ' '),
        (select string_agg(concat_ws(' ', ee.title, ee.area, pr.name,
                  case when coalesce((card.privacy->>'showCurrentCompany')::boolean, false) and coalesce((card.privacy->>'searchableByCompany')::boolean, false) then c.name end), ' ')
           from public."EmploymentExperience" ee
           join public."Company" c on c.id = ee."companyId"
           join public."Profession" pr on pr.id = ee."professionId"
          where ee."professionalProfileId" = card.id)),
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) as haystack
    from public.public_profile_cards card
  ), filtered as (
    select cards.*
    from cards, words
    where (p_work_mode is null or cards."workMode"::text = upper(p_work_mode))
      and (p_location is null or cards.location ilike '%' || public.escape_like(p_location) || '%')
      and (cardinality(words.list) = 0 or not exists (
        select 1 from unnest(words.list) w where position(w in cards.haystack) = 0))
      and (p_company_slug is null or ((coalesce((cards.privacy->>'searchableByCompany')::boolean, false) and coalesce((cards.privacy->>'showCurrentCompany')::boolean, false)) and exists (
        select 1 from public."EmploymentExperience" ee join public."Company" c on c.id = ee."companyId"
        where ee."professionalProfileId" = cards.id and c.slug = p_company_slug)))
      and (p_profession_slug is null or (coalesce((cards.privacy->>'searchableByProfession')::boolean, false) and exists (
        select 1 from public."EmploymentExperience" ee join public."Profession" p on p.id = ee."professionId"
        where ee."professionalProfileId" = cards.id and p.slug = p_profession_slug)))
  ), counted as (select *, count(*) over() total_count from filtered)
  select coalesce(jsonb_agg(jsonb_build_object('profile', to_jsonb(c) - 'total_count' - 'haystack', 'total_count', c.total_count) order by c."verificationStatus" = 'VERIFIED' desc, c.headline), '[]'::jsonb)
  from (select * from counted limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0)) c
$function$;
