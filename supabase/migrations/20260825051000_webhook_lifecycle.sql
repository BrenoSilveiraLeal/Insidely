alter table public."StripeWebhookEvent"
  add column if not exists status text not null default 'PROCESSED',
  add column if not exists "processedAt" timestamp with time zone,
  add column if not exists "lastError" text,
  add column if not exists attempts integer not null default 1;

create index if not exists stripe_webhook_status_idx on public."StripeWebhookEvent" (status, "createdAt");
