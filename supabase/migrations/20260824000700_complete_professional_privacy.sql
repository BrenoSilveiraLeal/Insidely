alter table public."ProfessionalProfile"
  add column if not exists "publicSurname" text;

create or replace function public.update_professional_profile(p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile_id text; v_experience_id text;
begin
  select pp.id into v_profile_id
  from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id
  where u.auth_user_id=(select auth.uid()) and u.role='CONSULTANT'::public."Role";
  if v_profile_id is null then raise exception 'profile_not_found'; end if;
  update public."ProfessionalProfile" set
    headline=coalesce(p_payload->>'headline',headline),
    bio=coalesce(p_payload->>'bio',bio),
    location=coalesce(p_payload->>'location',location),
    region=coalesce(p_payload->>'region',region),
    "publicSurname"=nullif(trim(p_payload->>'publicSurname'),''),
    "workMode"=coalesce(p_payload->>'workMode',"workMode"::text)::public."WorkMode",
    seniority=coalesce(p_payload->>'seniority',seniority::text)::public."Seniority",
    "yearsExperience"=coalesce(nullif(p_payload->>'yearsExperience','')::integer,"yearsExperience"),
    "price30Cents"=coalesce(nullif(p_payload->>'price30Cents','')::integer,"price30Cents"),
    "price60Cents"=coalesce(nullif(p_payload->>'price60Cents','')::integer,"price60Cents"),
    "responseHours"=coalesce(nullif(p_payload->>'responseHours','')::integer,"responseHours"),
    "pixKey"=nullif(p_payload->>'pixKey',''),
    topics=string_to_array(nullif(p_payload->>'topics',''),', '),
    boundaries=string_to_array(nullif(p_payload->>'boundaries',''),', '),
    "updatedAt"=now()
  where id=v_profile_id;
  select id into v_experience_id from public."EmploymentExperience" where "professionalProfileId"=v_profile_id order by "createdAt" limit 1;
  if v_experience_id is null then
    insert into public."EmploymentExperience" (id,"professionalProfileId","companyId","professionId",title,"isCurrent","createdAt") values(gen_random_uuid()::text,v_profile_id,p_payload->>'companyId',p_payload->>'professionId',coalesce(p_payload->>'title',''),true,now());
  else
    update public."EmploymentExperience" set "companyId"=coalesce(nullif(p_payload->>'companyId',''),"companyId"),"professionId"=coalesce(nullif(p_payload->>'professionId',''),"professionId"),title=coalesce(nullif(p_payload->>'title',''),title) where id=v_experience_id;
  end if;
end; $$;

create or replace view public.public_profile_cards as
select
  p.id,
  p.headline,
  case when coalesce(ps."showCity", false) then p.location else '' end as location,
  p."workMode",
  p."price30Cents",
  p."privacyMode",
  p.pseudonym,
  p."verificationStatus",
  jsonb_build_object(
    'name', case
      when coalesce(ps."showRealName", false) then
        case when coalesce(ps."showSurname", false)
          then coalesce(nullif(trim(concat_ws(' ', split_part(u.name, ' ', 1), p."publicSurname")), ''), split_part(u.name, ' ', 1))
          else split_part(u.name, ' ', 1)
        end
      else coalesce(p.pseudonym, 'Pessoa da comunidade')
    end,
    'image', case when coalesce(ps."showPhoto", false) then u.image else null end
  ) as "user",
  jsonb_build_object(
    'showRealName', coalesce(ps."showRealName", false),
    'showSurname', coalesce(ps."showSurname", false),
    'showPhoto', coalesce(ps."showPhoto", false),
    'showCurrentCompany', coalesce(ps."showCurrentCompany", false),
    'showCity', coalesce(ps."showCity", false),
    'showExactDates', coalesce(ps."showExactDates", false),
    'showFullHistory', coalesce(ps."showFullHistory", false),
    'searchableByCompany', coalesce(ps."searchableByCompany", false),
    'searchableByProfession', coalesce(ps."searchableByProfession", false)
  ) as privacy,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'company', jsonb_build_object(
            'name', case when coalesce(ps."showCurrentCompany", false) then c.name else 'Empresa não divulgada' end
          ),
          'profession', jsonb_build_object('name', pr.name)
        )
      )
      from public."EmploymentExperience" e
      join public."Company" c on c.id = e."companyId"
      join public."Profession" pr on pr.id = e."professionId"
      where e."professionalProfileId" = p.id
        and (coalesce(ps."showFullHistory", false) or e."isCurrent" = true)
    ),
    '[]'::jsonb
  ) as experiences,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'comment', r.comment,
          'user', jsonb_build_object('name', coalesce(ru.name, 'Consultante'))
        )
      )
      from public."Review" r
      join public."User" ru on ru.id = r."userId"
      where r."professionalProfileId" = p.id
    ),
    '[]'::jsonb
  ) as reviews,
  p.bio,
  p.region,
  p.seniority,
  p."yearsExperience",
  p."price60Cents",
  p."responseHours",
  p.topics,
  p.boundaries,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'startsAt', a."startsAt",
          'endsAt', a."endsAt",
          'isBooked', a."isBooked"
        ) order by a."startsAt"
      )
      from public."Availability" a
      where a."professionalProfileId" = p.id
        and a."isBooked" = false
        and a."startsAt" > now()
    ),
    '[]'::jsonb
  ) as availability
from public."ProfessionalProfile" p
join public."User" u on u.id = p."userId"
left join public."PrivacySettings" ps on ps."professionalProfileId" = p.id
where p."isActive" = true;
