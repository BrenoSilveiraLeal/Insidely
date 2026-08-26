-- Paginação do dashboard, múltiplas experiências e endurecimento de funções privilegiadas.

alter table public."ProfessionalProfile"
  add column if not exists "ageRange" text;

alter table public."PrivacySettings"
  add column if not exists "showAgeRange" boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ProfessionalProfile_ageRange_check') then
    alter table public."ProfessionalProfile"
      add constraint "ProfessionalProfile_ageRange_check"
      check ("ageRange" is null or "ageRange" in ('UNDER_25','25_34','35_44','45_54','55_PLUS'));
  end if;
end $$;

create index if not exists "Booking_professionalProfileId_startsAt_idx"
  on public."Booking" ("professionalProfileId", "startsAt" desc);
create index if not exists "EmploymentExperience_profile_current_idx"
  on public."EmploymentExperience" ("professionalProfileId", "isCurrent" desc, "startedAt" desc);

create or replace function public.update_privacy(p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $function$
declare v_profile_id text;
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  select pp.id into v_profile_id
  from public."ProfessionalProfile" pp
  join public."User" u on u.id = pp."userId"
  where u."auth_user_id" = auth.uid() and u.role = 'CONSULTANT'::public."Role";
  if v_profile_id is null then raise exception 'profile_not_found'; end if;
  update public."PrivacySettings" set
    "showRealName" = coalesce((p_payload->>'showRealName')::boolean, "showRealName"),
    "showSurname" = coalesce((p_payload->>'showSurname')::boolean, "showSurname"),
    "showPhoto" = coalesce((p_payload->>'showPhoto')::boolean, "showPhoto"),
    "showCurrentCompany" = coalesce((p_payload->>'showCurrentCompany')::boolean, "showCurrentCompany"),
    "showCity" = coalesce((p_payload->>'showCity')::boolean, "showCity"),
    "showExactDates" = coalesce((p_payload->>'showExactDates')::boolean, "showExactDates"),
    "showFullHistory" = coalesce((p_payload->>'showFullHistory')::boolean, "showFullHistory"),
    "showAgeRange" = coalesce((p_payload->>'showAgeRange')::boolean, "showAgeRange"),
    "searchableByCompany" = coalesce((p_payload->>'searchableByCompany')::boolean, "searchableByCompany"),
    "searchableByProfession" = coalesce((p_payload->>'searchableByProfession')::boolean, "searchableByProfession"),
    "updatedAt" = now()
  where "professionalProfileId" = v_profile_id;
  if not found then raise exception 'privacy_settings_not_found'; end if;
end;
$function$;

create or replace function public.update_professional_profile(p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $function$
declare
  v_profile_id text;
  v_experiences jsonb := coalesce(p_payload->'experiences', '[]'::jsonb);
  v_item jsonb;
  v_index integer := 0;
  v_started timestamp;
  v_ended timestamp;
begin
  if auth.uid() is null then raise exception 'not_authorized'; end if;
  select pp.id into v_profile_id
  from public."User" u join public."ProfessionalProfile" pp on pp."userId" = u.id
  where u."auth_user_id" = auth.uid() and u.role = 'CONSULTANT'::public."Role";
  if v_profile_id is null then raise exception 'profile_not_found'; end if;

  update public."ProfessionalProfile" set
    headline = coalesce(nullif(trim(p_payload->>'headline'), ''), headline),
    bio = coalesce(nullif(trim(p_payload->>'bio'), ''), bio),
    location = coalesce(nullif(trim(p_payload->>'location'), ''), location),
    region = coalesce(nullif(trim(p_payload->>'region'), ''), region),
    "publicSurname" = nullif(trim(p_payload->>'publicSurname'), ''),
    "ageRange" = nullif(p_payload->>'ageRange', ''),
    "workMode" = coalesce(p_payload->>'workMode', "workMode"::text)::public."WorkMode",
    seniority = coalesce(p_payload->>'seniority', seniority::text)::public."Seniority",
    "yearsExperience" = coalesce(nullif(p_payload->>'yearsExperience','')::integer, "yearsExperience"),
    "price30Cents" = coalesce(nullif(p_payload->>'price30Cents','')::integer, "price30Cents"),
    "price60Cents" = coalesce(nullif(p_payload->>'price60Cents','')::integer, "price60Cents"),
    "responseHours" = coalesce(nullif(p_payload->>'responseHours','')::integer, "responseHours"),
    "pixKey" = nullif(p_payload->>'pixKey',''),
    topics = string_to_array(nullif(p_payload->>'topics',''), ', '),
    boundaries = string_to_array(nullif(p_payload->>'boundaries',''), ', '),
    "updatedAt" = now()
  where id = v_profile_id;

  if jsonb_typeof(v_experiences) <> 'array' or jsonb_array_length(v_experiences) > 20 then
    raise exception 'invalid_experiences';
  end if;
  delete from public."EmploymentExperience" where "professionalProfileId" = v_profile_id;
  for v_item in select value from jsonb_array_elements(v_experiences)
  loop
    v_started := nullif(v_item->>'startedAt','')::timestamp;
    v_ended := nullif(v_item->>'endedAt','')::timestamp;
    if v_started is null or v_ended is not null and v_ended < v_started then raise exception 'invalid_experience_dates'; end if;
    insert into public."EmploymentExperience" (
      id, "professionalProfileId", "companyId", "professionId", title, area, "isCurrent", "startedAt", "endedAt", summary, "createdAt"
    ) values (
      coalesce(nullif(v_item->>'id',''), extensions.gen_random_uuid()::text), v_profile_id,
      nullif(v_item->>'companyId',''), nullif(v_item->>'professionId',''),
      left(coalesce(v_item->>'title',''), 160), left(coalesce(v_item->>'area',''), 160),
      coalesce((v_item->>'isCurrent')::boolean, false), v_started, v_ended,
      left(coalesce(v_item->>'summary',''), 2000), now()
    );
    v_index := v_index + 1;
  end loop;
end;
$function$;

create or replace function public.get_consultant_summary(p_user_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_profile public."ProfessionalProfile"; v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public."User" u where u.id=p_user_id and u."auth_user_id"=v_uid and u.role='CONSULTANT'::public."Role") then raise exception 'not_authorized'; end if;
  select p.* into v_profile from public."ProfessionalProfile" p where p."userId"=p_user_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'id',v_profile.id,'userId',v_profile."userId",'headline',v_profile.headline,'bio',v_profile.bio,'publicSurname',v_profile."publicSurname",
    'ageRange',v_profile."ageRange",'location',v_profile.location,'region',v_profile.region,'workMode',v_profile."workMode",'seniority',v_profile.seniority,
    'yearsExperience',v_profile."yearsExperience",'price30Cents',v_profile."price30Cents",'price60Cents',v_profile."price60Cents",'responseHours',v_profile."responseHours",
    'privacyMode',v_profile."privacyMode",'topics',v_profile.topics,'boundaries',v_profile.boundaries,'verificationStatus',v_profile."verificationStatus",
    'user',(select to_jsonb(u)-'passwordHash'-'twoFactorSecret'-'twoFactorRecoveryCodes' from public."User" u where u.id=p_user_id),
    'privacy',(select to_jsonb(ps) from public."PrivacySettings" ps where ps."professionalProfileId"=v_profile.id),
    'experiences',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('company',(select jsonb_build_object('name',c.name) from public."Company" c where c.id=e."companyId"),'profession',(select jsonb_build_object('name',p.name) from public."Profession" p where p.id=e."professionId")) order by e."isCurrent" desc,e."startedAt" desc) from public."EmploymentExperience" e where e."professionalProfileId"=v_profile.id),'[]'::jsonb),
    'availability',coalesce((select jsonb_agg(to_jsonb(a) order by a."startsAt") from public."Availability" a where a."professionalProfileId"=v_profile.id and a."endsAt">now()),'[]'::jsonb),
    'profileViews',coalesce((select jsonb_agg(jsonb_build_object('id',v.id)) from public."ProfileView" v where v."professionalProfileId"=v_profile.id),'[]'::jsonb),
    'favorites',coalesce((select jsonb_agg(jsonb_build_object('id',f.id)) from public."Favorite" f where f."professionalProfileId"=v_profile.id),'[]'::jsonb),
    'bookingCount',(select count(*) from public."Booking" b where b."professionalProfileId"=v_profile.id)
  );
end;
$function$;

create or replace function public.get_consultant_bookings(p_user_id text, p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_profile text; v_total integer; v_limit integer:=least(greatest(coalesce(p_limit,10),1),50); v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  select pp.id into v_profile from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id where u.id=p_user_id and u."auth_user_id"=auth.uid() and u.role='CONSULTANT'::public."Role";
  if v_profile is null then raise exception 'not_authorized'; end if;
  select count(*) into v_total from public."Booking" where "professionalProfileId"=v_profile;
  return jsonb_build_object('items',coalesce((select jsonb_agg(q.item order by q.starts_at desc) from (select to_jsonb(b)||jsonb_build_object('customer',(select jsonb_build_object('name',u.name) from public."User" u where u.id=b."customerId"),'payment',(select to_jsonb(p) from public."Payment" p where p."bookingId"=b.id),'conversation',(select jsonb_build_object('id',c.id) from public."Conversation" c where c."bookingId"=b.id)) as item,b."startsAt" as starts_at from public."Booking" b where b."professionalProfileId"=v_profile order by b."startsAt" desc limit v_limit offset v_offset) q),'[]'::jsonb),'total',v_total,'page',floor(v_offset/v_limit)::integer+1,'pageSize',v_limit);
end;
$function$;

create or replace function public.get_consultant_messages(p_user_id text, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_profile text; v_total integer; v_limit integer:=least(greatest(coalesce(p_limit,20),1),100); v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  select pp.id into v_profile from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id where u.id=p_user_id and u."auth_user_id"=auth.uid() and u.role='CONSULTANT'::public."Role";
  if v_profile is null then raise exception 'not_authorized'; end if;
  select count(*) into v_total from public."Message" m join public."Conversation" c on c.id=m."conversationId" join public."Booking" b on b.id=c."bookingId" where b."professionalProfileId"=v_profile;
  return jsonb_build_object('items',coalesce((select jsonb_agg(q.item order by q.created_at desc) from (select to_jsonb(m)||jsonb_build_object('bookingId',c."bookingId",'conversationId',c.id,'sender',(select jsonb_build_object('id',u.id,'name',u.name) from public."User" u where u.id=m."senderId")) as item,m."createdAt" as created_at from public."Message" m join public."Conversation" c on c.id=m."conversationId" join public."Booking" b on b.id=c."bookingId" where b."professionalProfileId"=v_profile order by m."createdAt" desc limit v_limit offset v_offset) q),'[]'::jsonb),'total',v_total,'page',floor(v_offset/v_limit)::integer+1,'pageSize',v_limit);
end;
$function$;

create or replace function public.get_consultant_notifications(p_user_id text, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_total integer; v_limit integer:=least(greatest(coalesce(p_limit,20),1),100); v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if auth.uid() is null or not exists(select 1 from public."User" where id=p_user_id and "auth_user_id"=auth.uid() and role='CONSULTANT'::public."Role") then raise exception 'not_authorized'; end if;
  select count(*) into v_total from public."Notification" where "userId"=p_user_id;
  return jsonb_build_object('items',coalesce((select jsonb_agg(q.item order by q.created_at desc) from (select to_jsonb(n) as item,n."createdAt" as created_at from public."Notification" n where n."userId"=p_user_id order by n."createdAt" desc limit v_limit offset v_offset) q),'[]'::jsonb),'total',v_total,'page',floor(v_offset/v_limit)::integer+1,'pageSize',v_limit);
end;
$function$;

create or replace function public.get_consultant_gains(p_user_id text, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_profile text; v_total integer; v_limit integer:=least(greatest(coalesce(p_limit,20),1),100); v_offset integer:=greatest(coalesce(p_offset,0),0); v_released bigint; v_held bigint;
begin
  select pp.id into v_profile from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id where u.id=p_user_id and u."auth_user_id"=auth.uid() and u.role='CONSULTANT'::public."Role";
  if v_profile is null then raise exception 'not_authorized'; end if;
  select count(*) into v_total from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile and p.status in ('HELD'::public."PaymentStatus",'RELEASED'::public."PaymentStatus");
  select coalesce(sum(case when p.status='RELEASED'::public."PaymentStatus" then b."totalCents"-b."feeCents" else 0 end),0),coalesce(sum(case when p.status='HELD'::public."PaymentStatus" then b."totalCents"-b."feeCents" else 0 end),0) into v_released,v_held from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile;
  return jsonb_build_object('items',coalesce((select jsonb_agg(q.item order by q.starts_at desc) from (select to_jsonb(b)||jsonb_build_object('customer',(select jsonb_build_object('name',u.name) from public."User" u where u.id=b."customerId"),'payment',to_jsonb(p)) as item,b."startsAt" as starts_at from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile and p.status in ('HELD'::public."PaymentStatus",'RELEASED'::public."PaymentStatus") order by b."startsAt" desc limit v_limit offset v_offset) q),'[]'::jsonb),'total',v_total,'page',floor(v_offset/v_limit)::integer+1,'pageSize',v_limit,'releasedTotalCents',v_released,'heldTotalCents',v_held);
end;
$function$;

revoke all on function public.get_consultant_summary(text), public.get_consultant_bookings(text,integer,integer), public.get_consultant_messages(text,integer,integer), public.get_consultant_notifications(text,integer,integer), public.get_consultant_gains(text,integer,integer) from public, anon;
grant execute on function public.get_consultant_summary(text), public.get_consultant_bookings(text,integer,integer), public.get_consultant_messages(text,integer,integer), public.get_consultant_notifications(text,integer,integer), public.get_consultant_gains(text,integer,integer) to authenticated;
revoke all on function public.update_privacy(jsonb), public.update_professional_profile(jsonb) from public, anon;
grant execute on function public.update_privacy(jsonb), public.update_professional_profile(jsonb) to authenticated;

-- Corrige as funções de cobertura que ainda tinham search_path amplo.
alter function public.update_profile_cover(text) set search_path = '';
alter function public.remove_profile_cover() set search_path = '';
alter function public.sync_google_profile(text,text) set search_path = 'public, auth, extensions';
alter function public.sync_social_profile(text,text) set search_path = 'public, auth, extensions';
alter function public.create_booking(text,text,integer,text[],text) set search_path = 'public, auth, extensions';
alter function public.report_booking_payment(text,text) set search_path = '';
alter function public.admin_confirm_booking_payment(text,text) set search_path = '';
alter function public.update_profile_image(text) set search_path = '';
