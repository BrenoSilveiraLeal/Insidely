-- The CI project intentionally revokes public table access. The isolated E2E
-- fixture uses the server-side service role and needs explicit table grants.
grant select, insert, update, delete on table
  public."Company",
  public."Profession",
  public."User",
  public."ProfessionalProfile",
  public."PrivacySettings",
  public."EmploymentExperience",
  public."Availability",
  public."Booking",
  public."Payment",
  public."Conversation",
  public."Message",
  public."Notification",
  public."Report",
  public."Review",
  public."TransferAttempt",
  public."StripeWebhookEvent",
  public."PaymentAuditEvent"
to service_role;
