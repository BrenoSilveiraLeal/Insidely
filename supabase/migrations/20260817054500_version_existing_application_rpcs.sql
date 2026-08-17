CREATE OR REPLACE FUNCTION public.create_consultant_availability(p_user_id text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_profile_id text;
  v_slot jsonb;
begin
  select pp.id into v_profile_id
  from public."ProfessionalProfile" pp
  join public."User" u on u.id = pp."userId"
  where pp."userId" = p_user_id
    and u."auth_user_id" = v_uid
    and u.role = 'CONSULTANT'::public."Role";

  if v_profile_id is null then raise exception 'profile_not_found'; end if;
  if p_starts_at <= now() + interval '15 minutes' or p_ends_at <= p_starts_at then
    raise exception 'invalid_time_range';
  end if;

  if exists (
    select 1 from public."Availability" a
    where a."professionalProfileId" = v_profile_id
      and a."startsAt" < p_ends_at
      and a."endsAt" > p_starts_at
  ) then raise exception 'availability_conflict'; end if;

  insert into public."Availability" (id, "professionalProfileId", "startsAt", "endsAt", "isBooked", "createdAt")
  values (gen_random_uuid()::text, v_profile_id, p_starts_at, p_ends_at, false, now())
  returning to_jsonb("Availability".*) into v_slot;

  return v_slot;
end;
$function$;


CREATE OR REPLACE FUNCTION public.create_review(p_booking_id text, p_rating integer, p_comment text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare uid text; b public."Booking";
begin
 select id into uid from public."User" where auth_user_id=auth.uid();
 if uid is null or p_rating not between 1 and 5 or length(trim(p_comment))<12 then raise exception 'invalid_request'; end if;
 select * into b from public."Booking" where id=p_booking_id and "customerId"=uid and status='COMPLETED'::public."BookingStatus";
 if b.id is null or exists(select 1 from public."Review" where "bookingId"=p_booking_id) then raise exception 'not_reviewable'; end if;
 insert into public."Review"(id,"bookingId","userId","professionalProfileId",rating,clarity,usefulness,contextualization,comment,"createdAt")
 values(gen_random_uuid()::text,b.id,uid,b."professionalProfileId",p_rating,p_rating,p_rating,p_rating,trim(p_comment),now());
end;
$function$;


CREATE OR REPLACE FUNCTION public.get_consultant_dashboard(p_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_auth uuid := auth.uid();
  v_profile public."ProfessionalProfile";
  v_result jsonb;
begin
  if v_auth is null or not exists (
    select 1 from public."User" u
    where u.id = p_user_id and u."auth_user_id" = v_auth and u.role = 'CONSULTANT'::public."Role"
  ) then
    raise exception 'not_authorized';
  end if;

  select p.* into v_profile from public."ProfessionalProfile" p where p."userId" = p_user_id;
  if not found then return null; end if;

  select jsonb_build_object(
    'id', v_profile.id,
    'userId', v_profile."userId",
    'headline', v_profile.headline,
    'bio', v_profile.bio,
    'location', v_profile.location,
    'region', v_profile.region,
    'workMode', v_profile."workMode",
    'seniority', v_profile.seniority,
    'yearsExperience', v_profile."yearsExperience",
    'price30Cents', v_profile."price30Cents",
    'price60Cents', v_profile."price60Cents",
    'pixKey', v_profile."pixKey",
    'responseHours', v_profile."responseHours",
    'privacyMode', v_profile."privacyMode",
    'pseudonym', v_profile.pseudonym,
    'avatarSeed', v_profile."avatarSeed",
    'topics', v_profile.topics,
    'boundaries', v_profile.boundaries,
    'verificationStatus', v_profile."verificationStatus",
    'isActive', v_profile."isActive",
    'createdAt', v_profile."createdAt",
    'updatedAt', v_profile."updatedAt",
    'user', (select to_jsonb(u) - 'passwordHash' - 'twoFactorSecret' - 'twoFactorRecoveryCodes' from public."User" u where u.id = p_user_id),
    'privacy', (select to_jsonb(x) from public."PrivacySettings" x where x."professionalProfileId" = v_profile.id),
    'experiences', coalesce((select jsonb_agg(to_jsonb(x) || jsonb_build_object(
      'company', (select to_jsonb(c) from public."Company" c where c.id=x."companyId"),
      'profession', (select to_jsonb(f) from public."Profession" f where f.id=x."professionId")
    ) order by x."isCurrent" desc) from public."EmploymentExperience" x where x."professionalProfileId"=v_profile.id), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(to_jsonb(a) order by a."startsAt") from public."Availability" a where a."professionalProfileId"=v_profile.id and a."endsAt" > now()), '[]'::jsonb),
    'profileViews', coalesce((select jsonb_agg(to_jsonb(v)) from public."ProfileView" v where v."professionalProfileId"=v_profile.id), '[]'::jsonb),
    'favorites', coalesce((select jsonb_agg(to_jsonb(f)) from public."Favorite" f where f."professionalProfileId"=v_profile.id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object(
      'customer', (select jsonb_build_object('id',u.id,'name',u.name) from public."User" u where u.id=b."customerId"),
      'payment', (select to_jsonb(pay) from public."Payment" pay where pay."bookingId"=b.id),
      'conversation', (select to_jsonb(c) || jsonb_build_object('messages', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('sender',(select jsonb_build_object('id',su.id,'name',su.name) from public."User" su where su.id=m."senderId")) order by m."createdAt") from public."Message" m where m."conversationId"=c.id), '[]'::jsonb)) from public."Conversation" c where c."bookingId"=b.id)
    ) order by b."startsAt" desc) from public."Booking" b where b."professionalProfileId"=v_profile.id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;


CREATE OR REPLACE FUNCTION public.release_eligible_bookings_for_user()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_user_id text;
  v_count integer := 0;
  b record;
begin
  select id into v_user_id from public."User" where "auth_user_id" = v_uid;
  if v_user_id is null then raise exception 'not_authorized'; end if;

  for b in
    select bk.id, bk."customerId"
    from public."Booking" bk
    join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
    join public."Payment" pay on pay."bookingId" = bk.id
    where pp."userId" = v_user_id
      and bk.status = 'AWAITING_CONFIRMATION'::public."BookingStatus"
      and bk."disputedAt" is null
      and pay.status = 'HELD'::public."PaymentStatus"
      and coalesce(bk."autoReleaseAt", bk."startsAt" + ((bk."durationMinutes" + 1440) * interval '1 minute')) <= now()
    for update of bk
  loop
    update public."Booking"
      set status = 'COMPLETED'::public."BookingStatus",
          "updatedAt" = now()
    where id = b.id;

    update public."Payment"
      set status = 'RELEASED'::public."PaymentStatus",
          "releasedAt" = now(),
          "updatedAt" = now()
    where "bookingId" = b.id;

    insert into public."Notification" ("id","userId",title,body,href,"createdAt")
    values
      (gen_random_uuid()::text, v_user_id, 'Repasse liberado', 'O prazo de confirmação terminou sem contestação. O repasse demonstrativo foi liberado.', '/consultor/ganhos', now()),
      (gen_random_uuid()::text, b."customerId", 'Conversa concluída', 'O prazo de confirmação terminou sem contestação.', '/dashboard/avaliacoes', now());

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;


CREATE OR REPLACE FUNCTION public.remove_consultant_availability(p_availability_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_user_id text;
  v_profile_id text;
begin
  select id into v_user_id from public."User" where "auth_user_id" = v_uid;
  select pp.id into v_profile_id from public."ProfessionalProfile" pp
    where pp."userId" = v_user_id;
  if v_profile_id is null then raise exception 'profile_not_found'; end if;

  delete from public."Availability" a
   where a.id = p_availability_id
     and a."professionalProfileId" = v_profile_id
     and a."isBooked" = false
     and a."startsAt" > now();

  if not found then raise exception 'availability_not_removable'; end if;
  return v_profile_id;
end;
$function$;


CREATE OR REPLACE FUNCTION public.toggle_favorite(p_profile_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid text;
begin
 select id into uid from public."User" where auth_user_id=auth.uid();
 if uid is null then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public."ProfessionalProfile" where id=p_profile_id and "isActive"=true) then raise exception 'profile_not_found'; end if;
 if exists(select 1 from public."Favorite" where "userId"=uid and "professionalProfileId"=p_profile_id) then
   delete from public."Favorite" where "userId"=uid and "professionalProfileId"=p_profile_id;
 else
   insert into public."Favorite"(id,"userId","professionalProfileId","createdAt") values(gen_random_uuid()::text,uid,p_profile_id,now());
 end if;
end;
$function$;


revoke execute on function public.create_consultant_availability(text,timestamptz,timestamptz), public.create_review(text,integer,text), public.get_consultant_dashboard(text), public.release_eligible_bookings_for_user(), public.remove_consultant_availability(text), public.toggle_favorite(text) from public, anon;
grant execute on function public.create_consultant_availability(text,timestamptz,timestamptz), public.create_review(text,integer,text), public.get_consultant_dashboard(text), public.release_eligible_bookings_for_user(), public.remove_consultant_availability(text), public.toggle_favorite(text) to authenticated;
