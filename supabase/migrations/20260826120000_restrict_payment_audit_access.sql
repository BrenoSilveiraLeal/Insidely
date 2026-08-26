-- Payment audit records are internal financial evidence. Client roles must not
-- read or mutate them; webhook and server-side operations use service_role.
revoke all on table public."PaymentAuditEvent" from anon, authenticated;
grant select, insert, update, delete on table public."PaymentAuditEvent" to service_role;
