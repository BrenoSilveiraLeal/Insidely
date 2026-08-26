-- Authenticated participants may read only the records needed for their own bookings.
create or replace function public.current_app_user_id()
returns text language sql security definer set search_path = '' as $$
  select u.id from public."User" u where u."auth_user_id" = (select auth.uid()) limit 1
$$;
revoke all on function public.current_app_user_id() from public, anon;
grant execute on function public.current_app_user_id() to authenticated;

grant select on public."Booking", public."Payment", public."Conversation", public."Message", public."Availability", public."Notification", public."Review" to authenticated;
grant select on public."ProfessionalProfile" to authenticated;

drop policy if exists booking_participant_select on public."Booking";
create policy booking_participant_select on public."Booking" for select to authenticated using (
  "customerId" = public.current_app_user_id()
  or exists (select 1 from public."ProfessionalProfile" p where p.id = "Booking"."professionalProfileId" and p."userId" = public.current_app_user_id())
);

drop policy if exists payment_participant_select on public."Payment";
create policy payment_participant_select on public."Payment" for select to authenticated using (
  exists (select 1 from public."Booking" b where b.id = "Payment"."bookingId" and (b."customerId" = public.current_app_user_id() or exists (select 1 from public."ProfessionalProfile" p where p.id=b."professionalProfileId" and p."userId"=public.current_app_user_id())))
);

drop policy if exists conversation_participant_select on public."Conversation";
create policy conversation_participant_select on public."Conversation" for select to authenticated using (
  exists (select 1 from public."Booking" b where b.id = "Conversation"."bookingId" and (b."customerId" = public.current_app_user_id() or exists (select 1 from public."ProfessionalProfile" p where p.id=b."professionalProfileId" and p."userId"=public.current_app_user_id())))
);

drop policy if exists availability_active_select on public."Availability";
create policy availability_active_select on public."Availability" for select to authenticated using (
  exists (select 1 from public."ProfessionalProfile" p where p.id = "Availability"."professionalProfileId" and p."isActive" = true)
);

drop policy if exists notification_owner_select on public."Notification";
create policy notification_owner_select on public."Notification" for select to authenticated using (
  "userId" = public.current_app_user_id()
);

drop policy if exists user_participant_select on public."User";
create policy user_participant_select on public."User" for select to authenticated using (
  "auth_user_id" = (select auth.uid())
  or exists (select 1 from public."Booking" b where b."customerId" = public.current_app_user_id() and b."customerId" = "User".id)
  or exists (select 1 from public."ProfessionalProfile" p join public."Booking" b on b."professionalProfileId" = p.id where p."userId" = "User".id and b."customerId" = public.current_app_user_id())
);
