-- Conclusão imediata de pagamentos simulados e ganhos retidos.
create or replace function public.confirm_booking(p_booking_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user text; v_booking public."Booking";
begin
  select id into v_user from public."User" where "auth_user_id" = auth.uid();
  select * into v_booking from public."Booking" where id = p_booking_id for update;
  if v_booking.id is null or v_booking.status not in ('CONFIRMED','AWAITING_CONFIRMATION') then raise exception 'invalid_state'; end if;
  if v_booking."customerId" = v_user then
    update public."Booking" set "customerConfirmedAt" = now(), status = 'AWAITING_CONFIRMATION', "updatedAt" = now() where id = p_booking_id;
  elsif exists(select 1 from public."ProfessionalProfile" where id = v_booking."professionalProfileId" and "userId" = v_user) then
    update public."Booking" set "consultantConfirmedAt" = now(), status = 'AWAITING_CONFIRMATION', "updatedAt" = now() where id = p_booking_id;
  else raise exception 'not_authorized'; end if;
  if (select "customerConfirmedAt" is not null and "consultantConfirmedAt" is not null from public."Booking" where id = p_booking_id) then
    if exists (select 1 from public."Payment" where "bookingId" = p_booking_id and provider = 'SIMULATION') then
      update public."Payment" set status = 'RELEASED', "releasedAt" = now(), "updatedAt" = now() where "bookingId" = p_booking_id;
      update public."Booking" set status = 'COMPLETED', "updatedAt" = now() where id = p_booking_id;
    else
      update public."Booking" set status = 'COMPLETED_RELEASE_PENDING', "updatedAt" = now() where id = p_booking_id;
    end if;
  end if;
end
$function$;

create or replace function public.get_consultant_gains(p_user_id text, p_limit integer default 20, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $function$
declare v_profile text; v_total integer; v_limit integer:=least(greatest(coalesce(p_limit,20),1),100); v_offset integer:=greatest(coalesce(p_offset,0),0); v_released bigint; v_held bigint;
begin
  select pp.id into v_profile from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id where u.id=p_user_id and u."auth_user_id"=auth.uid() and u.role='CONSULTANT'::public."Role";
  if v_profile is null then raise exception 'not_authorized'; end if;
  select count(*) into v_total from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile and p.status in ('HELD'::public."PaymentStatus",'PAID_HELD'::public."PaymentStatus",'RELEASED'::public."PaymentStatus");
  select coalesce(sum(case when p.status='RELEASED'::public."PaymentStatus" then b."totalCents"-b."feeCents" else 0 end),0),coalesce(sum(case when p.status in ('HELD'::public."PaymentStatus",'PAID_HELD'::public."PaymentStatus") then b."totalCents"-b."feeCents" else 0 end),0) into v_released,v_held from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile;
  return jsonb_build_object('items',coalesce((select jsonb_agg(q.item order by q.starts_at desc) from (select to_jsonb(b)||jsonb_build_object('customer',(select jsonb_build_object('name',u.name) from public."User" u where u.id=b."customerId"),'payment',to_jsonb(p)) as item,b."startsAt" as starts_at from public."Booking" b join public."Payment" p on p."bookingId"=b.id where b."professionalProfileId"=v_profile and p.status in ('HELD'::public."PaymentStatus",'RELEASED'::public."PaymentStatus") order by b."startsAt" desc limit v_limit offset v_offset) q),'[]'::jsonb),'total',v_total,'page',floor(v_offset/v_limit)::integer+1,'pageSize',v_limit,'releasedTotalCents',v_released,'heldTotalCents',v_held);
end;
$function$;

revoke all on function public.confirm_booking(text), public.get_consultant_gains(text,integer,integer) from public, anon;
grant execute on function public.confirm_booking(text), public.get_consultant_gains(text,integer,integer) to authenticated;
