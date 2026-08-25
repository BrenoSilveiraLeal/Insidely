create index if not exists payment_audit_actor_idx on public."PaymentAuditEvent" ("actorUserId");
create index if not exists payment_audit_payment_idx on public."PaymentAuditEvent" ("paymentId");

drop policy if exists booking_customer_insert on public."Booking";
create policy booking_customer_insert on public."Booking" as permissive for insert to authenticated
with check ("customerId" = (select u.id from public."User" u where u."auth_user_id" = (select auth.uid())));

drop policy if exists message_participant_insert on public."Message";
create policy message_participant_insert on public."Message" as permissive for insert to authenticated
with check (("senderId" = (select u.id from public."User" u where u."auth_user_id" = (select auth.uid()))) and exists (
  select 1 from public."Conversation" c
  join public."Booking" b on b.id = c."bookingId"
  left join public."ProfessionalProfile" p on p.id = b."professionalProfileId"
  where c.id = "Message"."conversationId" and (b."customerId" = "Message"."senderId" or p."userId" = "Message"."senderId")
));

drop policy if exists review_customer_insert on public."Review";
create policy review_customer_insert on public."Review" as permissive for insert to authenticated
with check (("userId" = (select u.id from public."User" u where u."auth_user_id" = (select auth.uid()))) and exists (
  select 1 from public."Booking" b where b.id = "Review"."bookingId" and b."customerId" = "Review"."userId" and b.status = 'COMPLETED'::public."BookingStatus"
));

drop policy if exists user_self_update on public."User";
create policy user_self_update on public."User" as permissive for update to authenticated
using ("auth_user_id" = (select auth.uid()))
with check ("auth_user_id" = (select auth.uid()));
