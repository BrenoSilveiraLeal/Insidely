-- "Consultas e mensagens" order, the same as the customer's lists (compareBookingsForList):
-- 0 message requests in progress; 1 still to happen (awaiting payment, confirmed), nearest first;
-- 2 already happened and still to settle (awaiting confirmation, disputed), most recent first;
-- 3 finished (completed, cancelled, expired, no-show), most recent first.
-- A conversation that already happened no longer sits above one still to happen.
create or replace function public.get_consultant_bookings(p_user_id text, p_limit integer default 10, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_profile text; v_total integer; v_limit integer:=least(greatest(coalesce(p_limit,10),1),50); v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  select pp.id into v_profile from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id where u.id=p_user_id and u."auth_user_id"=auth.uid() and u.role='CONSULTANT'::public."Role";
  if v_profile is null then raise exception 'not_authorized'; end if;
  select count(*) into v_total from public."Booking" where "professionalProfileId"=v_profile;
  return jsonb_build_object('items',coalesce((select jsonb_agg(q.item order by q.grp, q.sort_key) from (
    select to_jsonb(b)||jsonb_build_object('customer',(select jsonb_build_object('name',u.name) from public."User" u where u.id=b."customerId"),'payment',(select to_jsonb(p) from public."Payment" p where p."bookingId"=b.id),'conversation',(select jsonb_build_object('id',c.id) from public."Conversation" c where c."bookingId"=b.id)) as item,
      x.grp, case when x.grp < 2 then extract(epoch from b."startsAt") else -extract(epoch from b."startsAt") end as sort_key
    from public."Booking" b
    cross join lateral (select case
      when b.format = 'MESSAGE' and b.status = 'CONFIRMED'::public."BookingStatus" then 0
      when b.status in ('PENDING_PAYMENT'::public."BookingStatus", 'CONFIRMED'::public."BookingStatus", 'IN_PROGRESS'::public."BookingStatus") then 1
      when b.status in ('AWAITING_CONFIRMATION'::public."BookingStatus", 'DISPUTED'::public."BookingStatus") then 2
      else 3 end as grp) x
    where b."professionalProfileId"=v_profile
    order by x.grp, case when x.grp < 2 then extract(epoch from b."startsAt") else -extract(epoch from b."startsAt") end
    limit v_limit offset v_offset) q),'[]'::jsonb),'total',v_total,'page',floor(v_offset/v_limit)::integer+1,'pageSize',v_limit);
end;
$function$;
