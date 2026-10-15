-- Execute manualmente apenas no banco de demonstração.
with weekdays as (
  select d::date as day
  from generate_series(
    (timezone('America/Sao_Paulo', now())::date + 1)::timestamp,
    (timezone('America/Sao_Paulo', now())::date + 20)::timestamp,
    interval '1 day'
  ) d
  where extract(isodow from d) between 1 and 5
  limit 10
), slots as (
  select day, hour
  from weekdays cross join (values (10), (14), (19)) as h(hour)
), utc_slots as (
  select
    timezone('UTC', ((day + make_time(hour, 0, 0)) at time zone 'America/Sao_Paulo')) as starts_at,
    timezone('UTC', (((day + make_time(hour, 0, 0)) + interval '30 minutes') at time zone 'America/Sao_Paulo')) as ends_at
  from slots
), profiles as (
  select id from public."ProfessionalProfile"
  where id like 'profile-%' and "isActive" = true
)
insert into public."Availability" (id, "professionalProfileId", "startsAt", "endsAt", "isBooked", "createdAt")
select extensions.gen_random_uuid()::text, p.id, s.starts_at, s.ends_at, false, now()
from profiles p cross join utc_slots s
where not exists (
  select 1 from public."Availability" a
  where a."professionalProfileId" = p.id
    and a."startsAt" < s.ends_at and a."endsAt" > s.starts_at
);


-- Corrige exemplos muito distantes da área da empresa.
update public."EmploymentExperience" ee
set title = case ee."professionalProfileId"
  when 'profile-13' then 'Analista de Desenvolvimento Backend'
  when 'profile-73' then 'Engenheiro de Software'
  when 'profile-8' then 'Analista de Suporte ao Cliente'
  when 'profile-68' then 'Analista de Atendimento'
  when 'profile-53' then 'Analista de Relacionamento'
  when 'profile-33' then 'Especialista de Cloud'
  when 'profile-54' then 'Analista de Atendimento'
  when 'profile-34' then 'Atendente de Suporte'
end,
"professionId" = (select id from public."Profession" where name = case
  when ee."professionalProfileId" in ('profile-13','profile-73') then 'Desenvolvimento Backend'
  when ee."professionalProfileId" in ('profile-8','profile-68','profile-53','profile-54','profile-34') then 'Atendimento ao Cliente'
  when ee."professionalProfileId" = 'profile-33' then 'Cloud Computing'
end limit 1)
where ee."professionalProfileId" in ('profile-13','profile-73','profile-8','profile-68','profile-53','profile-33','profile-54','profile-34')
  and ee."isCurrent" = true;

update public."ProfessionalProfile"
set headline = case
  when id in ('profile-13','profile-73') then 'Profissional de tecnologia na Accenture'
  when id in ('profile-8','profile-68') then 'Analista de atendimento no PicPay'
  when id = 'profile-53' then 'Analista de relacionamento na XP'
  when id = 'profile-33' then 'Especialista de cloud na IBM'
  when id = 'profile-54' then 'Analista de atendimento no PicPay'
  when id = 'profile-34' then 'Atendente na Globo'
end
where id in ('profile-13','profile-73','profile-8','profile-68','profile-53','profile-33','profile-54','profile-34');

-- Diferencia o perfil duplicado profile-75 com uma trajetória coerente em RH.
update public."EmploymentExperience" ee
set title = 'Analista de Recursos Humanos',
    "professionId" = (select id from public."Profession" where name = 'Recursos Humanos' limit 1)
where ee."professionalProfileId" = 'profile-75' and ee."isCurrent" = true;

update public."ProfessionalProfile"
set headline = 'Analista de Recursos Humanos em McDonald’s'
where id = 'profile-75';

-- Nomes públicos variados para perfis protegidos sem pseudônimo.
update public."ProfessionalProfile" p
set pseudonym = case substring(p.id from '[0-9]+')::integer % 8
  when 0 then 'Dev Backend SP'
  when 1 then 'Atendente Centro RJ'
  when 2 then 'Analista de Produto BH'
  when 3 then 'Designer de Serviços POA'
  when 4 then 'Pessoa de Operações Recife'
  when 5 then 'Especialista Financeiro Curitiba'
  when 6 then 'Profissional de Dados Brasília'
  else 'Liderança de Tecnologia Campinas'
end
where p.id like 'profile-%'
  and p."privacyMode" <> 'PUBLIC'
  and nullif(trim(p.pseudonym), '') is null;

-- Mantém alguns exemplos sem comprovação para demonstrar os dois estados do selo.
update public."ProfessionalProfile"
set "verificationStatus" = 'NOT_SUBMITTED'
where id in ('profile-3', 'profile-18', 'profile-42', 'profile-67');
