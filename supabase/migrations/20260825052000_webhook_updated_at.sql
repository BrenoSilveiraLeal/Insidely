alter table public."StripeWebhookEvent" add column if not exists "updatedAt" timestamp with time zone not null default now();
