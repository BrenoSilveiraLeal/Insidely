-- Backend contracts used by the Next.js application. All privileged entry
-- points derive the application user from auth.uid(); client supplied user IDs
-- are never trusted.
create extension if not exists pg_trgm;

create index if not exists professional_profile_location_trgm_idx on public."ProfessionalProfile" using gin (location gin_trgm_ops);
create index if not exists professional_profile_headline_trgm_idx on public."ProfessionalProfile" using gin (headline gin_trgm_ops);
create index if not exists employment_experience_profile_company_profession_idx on public."EmploymentExperience" ("professionalProfileId","companyId","professionId");
create index if not exists booking_customer_starts_idx on public."Booking" ("customerId","startsAt" desc);
create index if not exists booking_professional_starts_idx on public."Booking" ("professionalProfileId","startsAt" desc);
create table if not exists public."AccountDeletionAudit"(id uuid primary key default gen_random_uuid(),auth_user_id uuid not null,requested_at timestamptz not null default now());
alter table public."AccountDeletionAudit" enable row level security;
revoke all on public."AccountDeletionAudit" from anon,authenticated;

create or replace function public.escape_like(value text) returns text language sql immutable set search_path='' as $$
 select replace(replace(replace(value,'\','\\'),'%','\%'),'_','\_')
$$;

create or replace function public.sync_social_profile(p_name text,p_image text)
returns table(role text,"onboardingCompleted" boolean) language sql security invoker set search_path='' as $$
 select * from public.sync_google_profile(p_name,p_image)
$$;

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
      and (p_company_slug is null or exists (
        select 1 from public."EmploymentExperience" ee join public."Company" c on c.id=ee."companyId"
        where ee."professionalProfileId"=card.id and c.slug=p_company_slug))
      and (p_profession_slug is null or exists (
        select 1 from public."EmploymentExperience" ee join public."Profession" p on p.id=ee."professionId"
        where ee."professionalProfileId"=card.id and p.slug=p_profession_slug))
  ), counted as (select *, count(*) over() total_count from filtered)
  select coalesce(jsonb_agg(jsonb_build_object('profile',to_jsonb(c)-'total_count','total_count',c.total_count) order by c."verificationStatus"='VERIFIED' desc,c.headline), '[]'::jsonb)
  from (select * from counted limit least(greatest(p_limit,1),50) offset greatest(p_offset,0)) c
$$;

create or replace function public.escape_like(value text) returns text language sql immutable set search_path='' as $$
 select replace(replace(replace(value,'\','\\'),'%','\%'),'_','\_')
$$;

create or replace function public.get_viewer_dashboard(p_user_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_auth uuid := auth.uid(); v_result jsonb;
begin
 if v_auth is null or not exists(select 1 from public."User" where id=p_user_id and auth_user_id=v_auth) then raise exception 'not_authorized'; end if;
 select jsonb_build_object(
  'id',u.id,'name',u.name,
  'customerBookings',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object(
    'professional',(select to_jsonb(pc) from public.public_profile_cards pc where pc.id=b."professionalProfileId"),
    'customer',jsonb_build_object('name',u.name),
    'payment',(select to_jsonb(p) from public."Payment" p where p."bookingId"=b.id),
    'review',(select to_jsonb(r) from public."Review" r where r."bookingId"=b.id),
    'conversation',(select to_jsonb(c)||jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m) order by m."createdAt") from public."Message" m where m."conversationId"=c.id),'[]'::jsonb)) from public."Conversation" c where c."bookingId"=b.id)
  ) order by b."startsAt" desc) from public."Booking" b where b."customerId"=u.id),'[]'::jsonb),
  'favorites',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('professionalProfile',(select to_jsonb(pc) from public.public_profile_cards pc where pc.id=f."professionalProfileId"))) from public."Favorite" f where f."userId"=u.id),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n."createdAt" desc) from public."Notification" n where n."userId"=u.id),'[]'::jsonb)
 ) into v_result from public."User" u where u.id=p_user_id;
 return v_result;
end $$;

create or replace function public.admin_resolve_report(p_report_id text,p_decision text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public."User" where auth_user_id=auth.uid() and role='ADMIN'::public."Role") then raise exception 'not_authorized'; end if;
 if p_decision not in ('RESOLVED','DISMISSED') then raise exception 'invalid_decision'; end if;
 update public."Report" set status=p_decision::public."ReportStatus","updatedAt"=now() where id=p_report_id and status in ('OPEN','IN_REVIEW');
 if not found then raise exception 'report_not_found_or_closed'; end if;
end $$;

create or replace function public.create_support_report(p_category text,p_description text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_user text;
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 if v_user is null or length(trim(p_category)) not between 2 and 80 or length(trim(p_description)) not between 20 and 4000 then raise exception 'invalid_request'; end if;
 insert into public."Report"(id,"reporterId",category,description,status,"createdAt","updatedAt")
 values(gen_random_uuid()::text,v_user,trim(p_category),trim(p_description),'OPEN',now(),now());
end $$;

create or replace function public.set_recording_consent(p_booking_id text,p_consented boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public."Booking" b set "consultantRecordingConsent"=p_consented,"updatedAt"=now()
 where b.id=p_booking_id and exists(select 1 from public."ProfessionalProfile" pp join public."User" u on u.id=pp."userId" where pp.id=b."professionalProfileId" and u.auth_user_id=auth.uid());
 if not found then raise exception 'not_authorized'; end if;
end $$;

create or replace function public.dispute_booking(p_booking_id text,p_description text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user text;
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 if length(trim(p_description)) not between 20 and 2000 then raise exception 'invalid_description'; end if;
 update public."Booking" b set status='DISPUTED'::public."BookingStatus","disputedAt"=now(),"disputeReason"=trim(p_description),"updatedAt"=now()
 where b.id=p_booking_id and b.status in ('CONFIRMED','AWAITING_CONFIRMATION') and (b."customerId"=v_user or exists(select 1 from public."ProfessionalProfile" pp where pp.id=b."professionalProfileId" and pp."userId"=v_user));
 if not found then raise exception 'not_authorized_or_invalid_state'; end if;
 update public."Payment" set status='DISPUTED'::public."PaymentStatus","updatedAt"=now() where "bookingId"=p_booking_id;
end $$;

create or replace function public.confirm_booking(p_booking_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user text; v_booking public."Booking";
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 select * into v_booking from public."Booking" where id=p_booking_id for update;
 if v_booking.id is null or v_booking.status not in ('CONFIRMED','AWAITING_CONFIRMATION') then raise exception 'invalid_state'; end if;
 if v_booking."customerId"=v_user then update public."Booking" set "customerConfirmedAt"=now(),status='AWAITING_CONFIRMATION',"updatedAt"=now() where id=p_booking_id;
 elsif exists(select 1 from public."ProfessionalProfile" where id=v_booking."professionalProfileId" and "userId"=v_user) then update public."Booking" set "consultantConfirmedAt"=now(),status='AWAITING_CONFIRMATION',"updatedAt"=now() where id=p_booking_id;
 else raise exception 'not_authorized'; end if;
 if (select "customerConfirmedAt" is not null and "consultantConfirmedAt" is not null from public."Booking" where id=p_booking_id) then
  update public."Booking" set status='COMPLETED',"updatedAt"=now() where id=p_booking_id;
  update public."Payment" set status='RELEASED',"releasedAt"=now(),"updatedAt"=now() where "bookingId"=p_booking_id and status in ('HELD','PAID_HELD');
 end if;
end $$;

create or replace function public.complete_booking(p_booking_id text) returns void language sql security invoker set search_path='' as $$
 select public.confirm_booking(p_booking_id)
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,3145728,array['image/jpeg','image/png','image/webp']),
      ('verification-documents','verification-documents',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "verification owner insert" on storage.objects;
create policy "verification owner insert" on storage.objects for insert to authenticated with check(bucket_id='verification-documents' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "verification owner read" on storage.objects;
create policy "verification owner read" on storage.objects for select to authenticated using(bucket_id='verification-documents' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public."User" where auth_user_id=auth.uid() and role='ADMIN')));
drop policy if exists "avatar owner delete" on storage.objects;
create policy "avatar owner delete" on storage.objects for delete to authenticated using(bucket_id='avatars' and owner_id=auth.uid()::text);

revoke execute on function public.search_public_profiles(text,text,text,text,text,integer,integer) from public;
grant execute on function public.search_public_profiles(text,text,text,text,text,integer,integer) to anon,authenticated;
revoke execute on function public.get_viewer_dashboard(text),public.admin_resolve_report(text,text),public.create_support_report(text,text),public.set_recording_consent(text,boolean),public.dispute_booking(text,text),public.confirm_booking(text),public.complete_booking(text) from public,anon;
grant execute on function public.get_viewer_dashboard(text),public.admin_resolve_report(text,text),public.create_support_report(text,text),public.set_recording_consent(text,boolean),public.dispute_booking(text,text),public.confirm_booking(text),public.complete_booking(text) to authenticated;

create or replace function public.send_message(p_conversation_id text,p_body text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user text; v_booking public."Booking";
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 if v_user is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'invalid_message'; end if;
 if p_body ~* '(https?://|www\.|whats?app|instagram|telegram|pix|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|([0-9]{2}[^0-9]*)?9?[0-9]{4}[^0-9]*[0-9]{4})' then raise exception 'contact_sharing_not_allowed'; end if;
 select b.* into v_booking from public."Conversation" c join public."Booking" b on b.id=c."bookingId" where c.id=p_conversation_id;
 if v_booking.id is null or v_booking.status not in ('CONFIRMED','AWAITING_CONFIRMATION') or now() > v_booking."startsAt"+interval '7 days' or not(v_booking."customerId"=v_user or exists(select 1 from public."ProfessionalProfile" p where p.id=v_booking."professionalProfileId" and p."userId"=v_user)) then raise exception 'not_authorized'; end if;
 if (select count(*) from public."Message" where "senderId"=v_user and "createdAt">now()-interval '1 minute')>=10 then raise exception 'rate_limited'; end if;
 insert into public."Message"(id,"conversationId","senderId",body,"createdAt") values(gen_random_uuid()::text,p_conversation_id,v_user,trim(p_body),now());
end $$;
revoke execute on function public.send_message(text,text) from public,anon;
grant execute on function public.send_message(text,text) to authenticated;
