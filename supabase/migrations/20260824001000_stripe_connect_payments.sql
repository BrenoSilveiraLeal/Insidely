alter table public."ProfessionalProfile"
  add column if not exists "stripeAccountId" text unique,
  add column if not exists "stripeOnboardingStatus" text not null default 'NOT_STARTED',
  add column if not exists "stripeChargesEnabled" boolean not null default false,
  add column if not exists "stripePayoutsEnabled" boolean not null default false;

alter table public."Payment"
  add column if not exists "stripeCheckoutSessionId" text unique,
  add column if not exists "stripePaymentIntentId" text unique,
  add column if not exists "stripeTransferId" text unique;

create table if not exists public."StripeWebhookEvent" (
  id text primary key,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);
alter table public."StripeWebhookEvent" enable row level security;
revoke all on public."StripeWebhookEvent" from anon, authenticated;

create index if not exists payment_stripe_intent_idx on public."Payment" ("stripePaymentIntentId");
create index if not exists payment_stripe_transfer_idx on public."Payment" ("stripeTransferId");
create index if not exists professional_stripe_account_idx on public."ProfessionalProfile" ("stripeAccountId");
