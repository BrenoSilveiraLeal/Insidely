-- Remove a duplicate public read policy and cover the TransferAttempt payment FK.
create index if not exists transfer_attempt_payment_idx
  on public."TransferAttempt" ("paymentId");

drop policy if exists public_profession_read on public."Profession";
