alter table public."Booking" add column if not exists "customerHiddenAt" timestamp(3) without time zone;

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
  ) order by b."startsAt" desc) from public."Booking" b where b."customerId"=u.id and b."customerHiddenAt" is null),'[]'::jsonb),
  'favorites',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('professionalProfile',(select to_jsonb(pc) from public.public_profile_cards pc where pc.id=f."professionalProfileId"))) from public."Favorite" f where f."userId"=u.id),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n."createdAt" desc) from public."Notification" n where n."userId"=u.id),'[]'::jsonb)
 ) into v_result from public."User" u where u.id=p_user_id;
 return v_result;
end $$;

create or replace function public.archive_customer_booking(p_booking_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user text;
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 if v_user is null then raise exception 'not_authorized'; end if;
 update public."Booking" set "customerHiddenAt"=now(), "updatedAt"=now()
 where id=p_booking_id and "customerId"=v_user and status in ('COMPLETED','COMPLETED_RELEASE_PENDING','CANCELLED','EXPIRED');
 if not found then raise exception 'booking_not_archivable'; end if;
end $$;
revoke all on function public.archive_customer_booking(text) from public, anon;
grant execute on function public.archive_customer_booking(text) to authenticated;
