-- Consultants can be current or former employees. The public profile now carries, per experience,
-- whether it is current, its period (year only, or year-month when the consultant allows exact
-- dates) and what the person did there. Without "full history" the main experience (current, or
-- else the most recent) is still shown, so a former employee never appears with no experience.
do $$
declare
  v_def text;
  v_old text := $old$COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'company', jsonb_build_object('name',
                CASE
                    WHEN COALESCE(ps."showCurrentCompany", false) THEN c.name
                    ELSE 'Empresa não divulgada'::text
                END), 'profession', jsonb_build_object('name', pr.name))) AS jsonb_agg
           FROM "EmploymentExperience" e
             JOIN "Company" c ON c.id = e."companyId"
             JOIN "Profession" pr ON pr.id = e."professionId"
          WHERE e."professionalProfileId" = p.id AND (COALESCE(ps."showFullHistory", false) OR e."isCurrent" = true)), '[]'::jsonb) AS experiences$old$;
  v_new text := $new$COALESCE(( SELECT jsonb_agg(x.obj ORDER BY x.rn) AS jsonb_agg
           FROM ( SELECT jsonb_build_object('id', e.id, 'title', e.title, 'company', jsonb_build_object('name',
                        CASE
                            WHEN COALESCE(ps."showCurrentCompany", false) THEN c.name
                            ELSE 'Empresa não divulgada'::text
                        END), 'profession', jsonb_build_object('name', pr.name), 'isCurrent', e."isCurrent",
                        'startedAt', to_char(e."startedAt", CASE WHEN COALESCE(ps."showExactDates", false) THEN 'YYYY-MM' ELSE 'YYYY' END),
                        'endedAt', CASE WHEN e."isCurrent" OR e."endedAt" IS NULL THEN NULL ELSE to_char(e."endedAt", CASE WHEN COALESCE(ps."showExactDates", false) THEN 'YYYY-MM' ELSE 'YYYY' END) END,
                        'summary', CASE WHEN e.summary = p.bio THEN '' ELSE e.summary END) AS obj,
                    row_number() OVER (ORDER BY e."isCurrent" DESC, e."startedAt" DESC) AS rn
                   FROM "EmploymentExperience" e
                     JOIN "Company" c ON c.id = e."companyId"
                     JOIN "Profession" pr ON pr.id = e."professionId"
                  WHERE e."professionalProfileId" = p.id) x
          WHERE COALESCE(ps."showFullHistory", false) OR x.rn = 1), '[]'::jsonb) AS experiences$new$;
begin
  v_def := pg_get_viewdef('public.public_profile_cards'::regclass, true);
  if position(v_old in v_def) = 0 then raise exception 'experiences block not found in public_profile_cards'; end if;
  execute 'create or replace view public.public_profile_cards as ' || replace(v_def, v_old, v_new);
end $$;

-- A proof of employment refers to one experience (current or former) of the consultant.
alter table public."Verification" add column if not exists "experienceId" text references public."EmploymentExperience"(id) on delete set null;
create index if not exists "Verification_experienceId_idx" on public."Verification" ("experienceId");
