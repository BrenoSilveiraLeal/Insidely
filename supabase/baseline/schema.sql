-- Generated from the production schema on 2026-08-17. Apply this baseline before the incremental migrations.
set check_function_bodies = off;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

do $enum$ begin create type public."BookingStatus" as enum ('PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'AWAITING_CONFIRMATION', 'DISPUTED', 'IN_PROGRESS', 'COMPLETED_RELEASE_PENDING'); exception when duplicate_object then null; end; $enum$;
do $enum$ begin create type public."PaymentStatus" as enum ('PENDING', 'APPROVED', 'REFUNDED', 'FAILED', 'HELD', 'RELEASED', 'DISPUTED', 'PAYMENT_REPORTED', 'PAID_HELD'); exception when duplicate_object then null; end; $enum$;
do $enum$ begin create type public."PrivacyMode" as enum ('PUBLIC', 'PROTECTED', 'PSEUDONYM'); exception when duplicate_object then null; end; $enum$;
do $enum$ begin create type public."ReportStatus" as enum ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'); exception when duplicate_object then null; end; $enum$;
do $enum$ begin create type public."Role" as enum ('USER', 'CONSULTANT', 'ADMIN'); exception when duplicate_object then null; end; $enum$;
do $enum$ begin create type public."Seniority" as enum ('INTERN', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'); exception when duplicate_object then null; end; $enum$;
do $enum$ begin create type public."VerificationStatus" as enum ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED', 'MORE_INFO_REQUIRED'); exception when duplicate_object then null; end; $enum$;
do $enum$ begin create type public."WorkMode" as enum ('REMOTE', 'HYBRID', 'ONSITE'); exception when duplicate_object then null; end; $enum$;

create table if not exists public."Account" (id text not null,
  "userId" text not null,
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text);

create table if not exists public."AccountDeletionAudit" (id uuid default gen_random_uuid() not null,
  auth_user_id uuid not null,
  requested_at timestamp with time zone default now() not null);

create table if not exists public."AuditLog" (id text default (gen_random_uuid())::text not null,
  "actorAuthUserId" uuid not null,
  action text not null,
  resourceid text,
  metadata jsonb default '{}'::jsonb not null,
  "createdAt" timestamp with time zone default now() not null);

create table if not exists public."Availability" (id text not null,
  "professionalProfileId" text not null,
  "startsAt" timestamp(3) without time zone not null,
  "endsAt" timestamp(3) without time zone not null,
  "isBooked" boolean default false not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null);

create table if not exists public."Booking" (id text not null,
  "customerId" text not null,
  "professionalProfileId" text not null,
  "availabilityId" text,
  "startsAt" timestamp(3) without time zone not null,
  "durationMinutes" integer not null,
  topics text[],
  goals text not null,
  status "BookingStatus" default 'PENDING_PAYMENT'::"BookingStatus" not null,
  "subtotalCents" integer not null,
  "feeCents" integer not null,
  "totalCents" integer not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null,
  "customerConfirmedAt" timestamp(3) without time zone,
  "consultantConfirmedAt" timestamp(3) without time zone,
  "autoReleaseAt" timestamp(3) without time zone,
  "disputedAt" timestamp(3) without time zone,
  "paymentReportedAt" timestamp with time zone,
  "paymentConfirmedAt" timestamp with time zone,
  "paymentRejectedAt" timestamp with time zone,
  "disputeReason" text,
  "releaseEligibleAt" timestamp with time zone);

create table if not exists public."Company" (id text not null,
  slug text not null,
  name text not null,
  sector text not null,
  description text not null,
  "logoText" text not null,
  color text not null,
  location text not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null);

create table if not exists public."Conversation" (id text not null,
  "bookingId" text not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null);

create table if not exists public."EmploymentExperience" (id text not null,
  "professionalProfileId" text not null,
  "companyId" text not null,
  "professionId" text not null,
  title text not null,
  area text not null,
  "isCurrent" boolean default false not null,
  "startedAt" timestamp(3) without time zone not null,
  "endedAt" timestamp(3) without time zone,
  summary text not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null);

create table if not exists public."Favorite" (id text not null,
  "userId" text not null,
  "professionalProfileId" text not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null);

create table if not exists public."Message" (id text not null,
  "conversationId" text not null,
  "senderId" text not null,
  body text not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "readAt" timestamp(3) without time zone);

create table if not exists public."Notification" (id text not null,
  "userId" text not null,
  title text not null,
  body text not null,
  href text,
  "readAt" timestamp(3) without time zone,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null);

create table if not exists public."Payment" (id text not null,
  "bookingId" text not null,
  status "PaymentStatus" default 'PENDING'::"PaymentStatus" not null,
  "amountCents" integer not null,
  provider text default 'SIMULATED'::text not null,
  "providerRef" text,
  "paidAt" timestamp(3) without time zone,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null,
  "releasedAt" timestamp(3) without time zone);

create table if not exists public."PaymentAuditEvent" (id uuid default gen_random_uuid() not null,
  "bookingId" text not null,
  "paymentId" text,
  "actorUserId" text,
  "actorAuthId" uuid,
  "previousBookingStatus" "BookingStatus",
  "newBookingStatus" "BookingStatus",
  "previousPaymentStatus" "PaymentStatus",
  "newPaymentStatus" "PaymentStatus",
  observation text default ''::text not null,
  "createdAt" timestamp with time zone default now() not null);

create table if not exists public."PrivacySettings" (id text not null,
  "professionalProfileId" text not null,
  "showRealName" boolean default false not null,
  "showSurname" boolean default false not null,
  "showPhoto" boolean default false not null,
  "showCurrentCompany" boolean default true not null,
  "showCity" boolean default false not null,
  "showExactDates" boolean default false not null,
  "showFullHistory" boolean default false not null,
  "searchableByCompany" boolean default true not null,
  "searchableByProfession" boolean default true not null,
  "updatedAt" timestamp(3) without time zone not null);

create table if not exists public."Profession" (id text not null,
  slug text not null,
  name text not null,
  category text not null,
  description text not null,
  accent text not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null);

create table if not exists public."ProfessionalProfile" (id text not null,
  "userId" text not null,
  headline text not null,
  bio text not null,
  location text not null,
  region text not null,
  "workMode" "WorkMode" not null,
  seniority "Seniority" not null,
  "yearsExperience" integer not null,
  "price30Cents" integer not null,
  "price60Cents" integer not null,
  "responseHours" integer default 12 not null,
  "privacyMode" "PrivacyMode" default 'PROTECTED'::"PrivacyMode" not null,
  pseudonym text,
  "avatarSeed" text not null,
  topics text[],
  boundaries text[],
  "verificationStatus" "VerificationStatus" default 'NOT_SUBMITTED'::"VerificationStatus" not null,
  "isActive" boolean default true not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null,
  "pixKey" text);

create table if not exists public."ProfileView" (id text not null,
  "professionalProfileId" text not null,
  "viewerHash" text not null,
  "viewedAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null);

create table if not exists public."RealityCheck" (id text not null,
  "professionId" text not null,
  title text not null,
  intro text not null,
  imagined text[],
  practical text[],
  routine jsonb not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null);

create table if not exists public."Report" (id text not null,
  "reporterId" text not null,
  "targetUserId" text,
  "bookingId" text,
  category text not null,
  description text not null,
  status "ReportStatus" default 'OPEN'::"ReportStatus" not null,
  resolution text,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null);

create table if not exists public."Review" (id text not null,
  "bookingId" text not null,
  "userId" text not null,
  "professionalProfileId" text not null,
  rating integer not null,
  clarity integer not null,
  usefulness integer not null,
  contextualization integer not null,
  comment text,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null);

create table if not exists public."Session" (id text not null,
  "sessionToken" text not null,
  "userId" text not null,
  expires timestamp(3) without time zone not null);

create table if not exists public."User" (id text not null,
  name text not null,
  email text not null,
  "emailVerified" timestamp(3) without time zone,
  image text,
  "passwordHash" text,
  role "Role" default 'USER'::"Role" not null,
  "onboardingCompleted" boolean default false not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null,
  "twoFactorEnabled" boolean default false not null,
  "twoFactorSecret" text,
  "twoFactorRecoveryCodes" text[] default ARRAY[]::text[] not null,
  "twoFactorSetupSecret" text,
  "twoFactorSetupExpiresAt" timestamp(3) without time zone,
  "failedLoginAttempts" integer default 0 not null,
  "lastFailedLoginAt" timestamp(3) without time zone,
  "lockedUntil" timestamp(3) without time zone,
  auth_user_id uuid);

create table if not exists public."Verification" (id text not null,
  "professionalProfileId" text not null,
  method text not null,
  status "VerificationStatus" default 'PENDING'::"VerificationStatus" not null,
  "adminNotes" text,
  "reviewerId" text,
  "reviewedAt" timestamp(3) without time zone,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamp(3) without time zone not null);

create table if not exists public."VerificationDocument" (id text not null,
  "verificationId" text not null,
  "originalName" text not null,
  "mimeType" text not null,
  "sizeBytes" integer not null,
  "storageKey" text not null,
  "createdAt" timestamp(3) without time zone default CURRENT_TIMESTAMP not null);

create table if not exists public."VerificationToken" (identifier text not null,
  token text not null,
  expires timestamp(3) without time zone not null);

do $constraint$ begin alter table "AccountDeletionAudit" add constraint "AccountDeletionAudit_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Account" add constraint "Account_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "AuditLog" add constraint "AuditLog_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Availability" add constraint "Availability_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Booking" add constraint "Booking_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Company" add constraint "Company_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Conversation" add constraint "Conversation_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "EmploymentExperience" add constraint "EmploymentExperience_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Favorite" add constraint "Favorite_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Message" add constraint "Message_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Notification" add constraint "Notification_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "PaymentAuditEvent" add constraint "PaymentAuditEvent_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Payment" add constraint "Payment_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "PrivacySettings" add constraint "PrivacySettings_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Profession" add constraint "Profession_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "ProfessionalProfile" add constraint "ProfessionalProfile_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "ProfileView" add constraint "ProfileView_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "RealityCheck" add constraint "RealityCheck_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Report" add constraint "Report_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Review" add constraint "Review_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Session" add constraint "Session_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "User" add constraint "User_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "VerificationDocument" add constraint "VerificationDocument_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "VerificationToken" add constraint "VerificationToken_pkey" PRIMARY KEY (identifier, token); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Verification" add constraint "Verification_pkey" PRIMARY KEY (id); exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Account" add constraint "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Availability" add constraint "Availability_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Booking" add constraint "Booking_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "Availability"(id) ON UPDATE CASCADE ON DELETE SET NULL; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Booking" add constraint "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE RESTRICT; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Booking" add constraint "Booking_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"(id) ON UPDATE CASCADE ON DELETE RESTRICT; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Conversation" add constraint "Conversation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "EmploymentExperience" add constraint "EmploymentExperience_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON UPDATE CASCADE ON DELETE RESTRICT; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "EmploymentExperience" add constraint "EmploymentExperience_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"(id) ON UPDATE CASCADE ON DELETE RESTRICT; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "EmploymentExperience" add constraint "EmploymentExperience_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Favorite" add constraint "Favorite_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Favorite" add constraint "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Message" add constraint "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Message" add constraint "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Notification" add constraint "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "PaymentAuditEvent" add constraint "PaymentAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"(id) ON DELETE SET NULL; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "PaymentAuditEvent" add constraint "PaymentAuditEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"(id) ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "PaymentAuditEvent" add constraint "PaymentAuditEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"(id) ON DELETE SET NULL; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Payment" add constraint "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "PrivacySettings" add constraint "PrivacySettings_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "ProfessionalProfile" add constraint "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "ProfileView" add constraint "ProfileView_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "RealityCheck" add constraint "RealityCheck_professionId_fkey" FOREIGN KEY ("professionId") REFERENCES "Profession"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Report" add constraint "Report_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"(id) ON UPDATE CASCADE ON DELETE SET NULL; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Report" add constraint "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Report" add constraint "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Review" add constraint "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Review" add constraint "Review_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Review" add constraint "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Session" add constraint "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "VerificationDocument" add constraint "VerificationDocument_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "Verification"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;
do $constraint$ begin alter table "Verification" add constraint "Verification_professionalProfileId_fkey" FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"(id) ON UPDATE CASCADE ON DELETE CASCADE; exception when duplicate_object then null; end; $constraint$;

CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON public."Account" USING btree (provider, "providerAccountId");
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON public."Account" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "Availability_professionalProfileId_startsAt_idx" ON public."Availability" USING btree ("professionalProfileId", "startsAt");
CREATE UNIQUE INDEX "Booking_availabilityId_key" ON public."Booking" USING btree ("availabilityId");
CREATE INDEX IF NOT EXISTS "Booking_customerId_startsAt_idx" ON public."Booking" USING btree ("customerId", "startsAt");
CREATE INDEX IF NOT EXISTS "Booking_professionalProfileId_startsAt_idx" ON public."Booking" USING btree ("professionalProfileId", "startsAt");
CREATE UNIQUE INDEX "Company_slug_key" ON public."Company" USING btree (slug);
CREATE UNIQUE INDEX "Conversation_bookingId_key" ON public."Conversation" USING btree ("bookingId");
CREATE INDEX IF NOT EXISTS "EmploymentExperience_companyId_idx" ON public."EmploymentExperience" USING btree ("companyId");
CREATE INDEX IF NOT EXISTS "EmploymentExperience_professionId_idx" ON public."EmploymentExperience" USING btree ("professionId");
CREATE INDEX IF NOT EXISTS "EmploymentExperience_professionalProfileId_idx" ON public."EmploymentExperience" USING btree ("professionalProfileId");
CREATE INDEX IF NOT EXISTS "Favorite_professionalProfileId_idx" ON public."Favorite" USING btree ("professionalProfileId");
CREATE UNIQUE INDEX "Favorite_userId_professionalProfileId_key" ON public."Favorite" USING btree ("userId", "professionalProfileId");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON public."Message" USING btree ("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON public."Message" USING btree ("senderId");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON public."Notification" USING btree ("userId", "createdAt");
CREATE UNIQUE INDEX "Payment_bookingId_key" ON public."Payment" USING btree ("bookingId");
CREATE UNIQUE INDEX "PrivacySettings_professionalProfileId_key" ON public."PrivacySettings" USING btree ("professionalProfileId");
CREATE UNIQUE INDEX "Profession_slug_key" ON public."Profession" USING btree (slug);
CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON public."ProfessionalProfile" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "ProfileView_professionalProfileId_viewedAt_idx" ON public."ProfileView" USING btree ("professionalProfileId", "viewedAt");
CREATE UNIQUE INDEX "RealityCheck_professionId_key" ON public."RealityCheck" USING btree ("professionId");
CREATE INDEX IF NOT EXISTS "Report_bookingId_idx" ON public."Report" USING btree ("bookingId");
CREATE INDEX IF NOT EXISTS "Report_reporterId_idx" ON public."Report" USING btree ("reporterId");
CREATE INDEX IF NOT EXISTS "Report_targetUserId_idx" ON public."Report" USING btree ("targetUserId");
CREATE UNIQUE INDEX "Review_bookingId_key" ON public."Review" USING btree ("bookingId");
CREATE INDEX IF NOT EXISTS "Review_professionalProfileId_idx" ON public."Review" USING btree ("professionalProfileId");
CREATE INDEX IF NOT EXISTS "Review_userId_idx" ON public."Review" USING btree ("userId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON public."Session" USING btree ("sessionToken");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON public."Session" USING btree ("userId");
CREATE UNIQUE INDEX "User_auth_user_id_key" ON public."User" USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);
CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);
CREATE INDEX IF NOT EXISTS "VerificationDocument_verificationId_idx" ON public."VerificationDocument" USING btree ("verificationId");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON public."VerificationToken" USING btree (token);
CREATE INDEX IF NOT EXISTS "Verification_professionalProfileId_idx" ON public."Verification" USING btree ("professionalProfileId");
CREATE INDEX IF NOT EXISTS "Verification_status_createdAt_idx" ON public."Verification" USING btree (status, "createdAt");
CREATE INDEX IF NOT EXISTS booking_customer_starts_idx ON public."Booking" USING btree ("customerId", "startsAt" DESC);
CREATE INDEX IF NOT EXISTS booking_professional_starts_idx ON public."Booking" USING btree ("professionalProfileId", "startsAt" DESC);
CREATE INDEX IF NOT EXISTS booking_status_idx ON public."Booking" USING btree (status);
CREATE INDEX IF NOT EXISTS employment_company_idx ON public."EmploymentExperience" USING btree ("companyId", "professionalProfileId");
CREATE INDEX IF NOT EXISTS employment_experience_profile_company_profession_idx ON public."EmploymentExperience" USING btree ("professionalProfileId", "companyId", "professionId");
CREATE INDEX IF NOT EXISTS employment_profession_idx ON public."EmploymentExperience" USING btree ("professionId", "professionalProfileId");
CREATE INDEX IF NOT EXISTS payment_audit_booking_created_idx ON public."PaymentAuditEvent" USING btree ("bookingId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS professional_profile_headline_trgm_idx ON public."ProfessionalProfile" USING gin (headline gin_trgm_ops);
CREATE INDEX IF NOT EXISTS professional_profile_location_idx ON public."ProfessionalProfile" USING btree (location);
CREATE INDEX IF NOT EXISTS professional_profile_location_trgm_idx ON public."ProfessionalProfile" USING gin (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS professional_profile_mode_idx ON public."ProfessionalProfile" USING btree ("workMode");
CREATE INDEX IF NOT EXISTS professional_profile_public_active_idx ON public."ProfessionalProfile" USING btree ("isActive", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS review_booking_idx ON public."Review" USING btree ("bookingId");

create or replace view public.home_metrics as  SELECT ( SELECT count(*) AS count
           FROM ("ProfessionalProfile" p
             JOIN "User" u ON ((u.id = p."userId")))
          WHERE ((p."isActive" = true) AND (u."onboardingCompleted" = true))) AS active_professionals,
    ( SELECT count(DISTINCT e."companyId") AS count
           FROM (("EmploymentExperience" e
             JOIN "ProfessionalProfile" p ON ((p.id = e."professionalProfileId")))
             JOIN "User" u ON ((u.id = p."userId")))
          WHERE ((p."isActive" = true) AND (u."onboardingCompleted" = true))) AS represented_companies,
    ( SELECT count(*) AS count
           FROM "Booking" b
          WHERE (b.status = 'COMPLETED'::"BookingStatus")) AS completed_conversations,
    COALESCE(( SELECT round(avg(r.rating), 1) AS round
           FROM ("Review" r
             JOIN "Booking" b ON ((b.id = r."bookingId")))
          WHERE (b.status = 'COMPLETED'::"BookingStatus")), (0)::numeric) AS average_rating;;
alter view public.home_metrics set (security_invoker=false);

create or replace view public.public_company_cards as  SELECT id,
    slug,
    name,
    sector,
    description,
    "logoText",
    color,
    location,
    "createdAt",
    "updatedAt",
    jsonb_build_object('experiences', ( SELECT count(*) AS count
           FROM "EmploymentExperience" e
          WHERE (e."companyId" = c.id))) AS _count
   FROM "Company" c;;
alter view public.public_company_cards set (security_invoker=false);

create or replace view public.public_company_details as  SELECT id,
    slug,
    name,
    sector,
    description,
    "logoText",
    color,
    location,
    jsonb_build_object('experiences', ( SELECT count(*) AS count
           FROM (("EmploymentExperience" e
             JOIN "ProfessionalProfile" p ON ((p.id = e."professionalProfileId")))
             JOIN "User" u ON ((u.id = p."userId")))
          WHERE ((e."companyId" = c.id) AND (p."isActive" = true) AND (u."onboardingCompleted" = true)))) AS _count
   FROM "Company" c;;
alter view public.public_company_details set (security_invoker=false);

create or replace view public.public_profession_cards as  SELECT id,
    slug,
    name,
    category,
    description,
    accent,
    "createdAt",
    "updatedAt",
    jsonb_build_object('experiences', ( SELECT count(*) AS count
           FROM "EmploymentExperience" e
          WHERE (e."professionId" = p.id))) AS _count
   FROM "Profession" p;;
alter view public.public_profession_cards set (security_invoker=false);

create or replace view public.public_profession_details as  SELECT id,
    slug,
    name,
    category,
    description,
    accent,
    jsonb_build_object('experiences', ( SELECT count(*) AS count
           FROM (("EmploymentExperience" e
             JOIN "ProfessionalProfile" pp ON ((pp.id = e."professionalProfileId")))
             JOIN "User" u ON ((u.id = pp."userId")))
          WHERE ((e."professionId" = p.id) AND (pp."isActive" = true) AND (u."onboardingCompleted" = true)))) AS _count
   FROM "Profession" p;;
alter view public.public_profession_details set (security_invoker=false);

create or replace view public.public_profile_cards as  SELECT p.id,
    p.headline,
    p.location,
    p."workMode",
    p."price30Cents",
    p."privacyMode",
    p.pseudonym,
    p."verificationStatus",
    jsonb_build_object('name',
        CASE
            WHEN COALESCE(ps."showRealName", false) THEN u.name
            ELSE COALESCE(p.pseudonym, 'Pessoa da comunidade'::text)
        END, 'image',
        CASE
            WHEN COALESCE(ps."showPhoto", false) THEN u.image
            ELSE NULL::text
        END) AS "user",
    jsonb_build_object('showPhoto', COALESCE(ps."showPhoto", false)) AS privacy,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'company', jsonb_build_object('name', c.name), 'profession', jsonb_build_object('name', pr.name))) AS jsonb_agg
           FROM (("EmploymentExperience" e
             JOIN "Company" c ON ((c.id = e."companyId")))
             JOIN "Profession" pr ON ((pr.id = e."professionId")))
          WHERE (e."professionalProfileId" = p.id)), '[]'::jsonb) AS experiences,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', r.id, 'rating', r.rating, 'comment', r.comment, 'user', jsonb_build_object('name', COALESCE(ru.name, 'Consultante'::text)))) AS jsonb_agg
           FROM ("Review" r
             JOIN "User" ru ON ((ru.id = r."userId")))
          WHERE (r."professionalProfileId" = p.id)), '[]'::jsonb) AS reviews,
    p.bio,
    p.region,
    p.seniority,
    p."yearsExperience",
    p."price60Cents",
    p."responseHours",
    p.topics,
    p.boundaries,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', a.id, 'startsAt', a."startsAt", 'endsAt', a."endsAt", 'isBooked', a."isBooked") ORDER BY a."startsAt") AS jsonb_agg
           FROM "Availability" a
          WHERE ((a."professionalProfileId" = p.id) AND (a."isBooked" = false) AND (a."startsAt" > now()))), '[]'::jsonb) AS availability
   FROM (("ProfessionalProfile" p
     JOIN "User" u ON ((u.id = p."userId")))
     LEFT JOIN "PrivacySettings" ps ON ((ps."professionalProfileId" = p.id)))
  WHERE (p."isActive" = true);;
alter view public.public_profile_cards set (security_invoker=false);

CREATE OR REPLACE FUNCTION public.admin_confirm_booking_payment(p_booking_id text, p_observation text DEFAULT ''::text)
 RETURNS "PaymentStatus"
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_auth uuid := auth.uid();
  v_admin public."User";
  v_booking public."Booking";
  v_payment public."Payment";
  v_next public."PaymentStatus" := 'PAID_HELD'::public."PaymentStatus";
begin
  select * into v_admin from public."User" where "auth_user_id" = v_auth and role = 'ADMIN'::public."Role";
  if v_admin.id is null then raise exception 'not_authorized'; end if;
  select * into v_booking from public."Booking" where id = p_booking_id for update;
  select * into v_payment from public."Payment" where "bookingId" = p_booking_id for update;
  if v_booking.id is null or v_payment.id is null then raise exception 'booking_or_payment_not_found'; end if;
  if v_payment.status = v_next then return v_next; end if;
  if v_payment.status <> 'PAYMENT_REPORTED'::public."PaymentStatus" then raise exception 'invalid_payment_state'; end if;
  update public."Payment" set status = v_next, "paidAt" = now(), "updatedAt" = now() where id = v_payment.id;
  update public."Booking" set status = 'CONFIRMED'::public."BookingStatus", "paymentConfirmedAt" = now(), "updatedAt" = now() where id = p_booking_id;
  insert into public."PaymentAuditEvent" ("bookingId","paymentId","actorUserId","actorAuthId","previousBookingStatus","newBookingStatus","previousPaymentStatus","newPaymentStatus",observation)
  values (p_booking_id,v_payment.id,v_admin.id,v_auth,v_booking.status,'CONFIRMED'::public."BookingStatus",v_payment.status,v_next,coalesce(nullif(p_observation,''),'Pagamento confirmado pela administração'));
  return v_next;
end;
$function$;
;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report_id text, p_decision text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not exists(select 1 from public."User" where auth_user_id=auth.uid() and role='ADMIN'::public."Role") then raise exception 'not_authorized'; end if;
 if p_decision not in ('RESOLVED','DISMISSED') then raise exception 'invalid_decision'; end if;
 update public."Report" set status=p_decision::public."ReportStatus","updatedAt"=now() where id=p_report_id and status in ('OPEN','IN_REVIEW');
 if not found then raise exception 'report_not_found_or_closed'; end if;
end; $function$;
;

CREATE OR REPLACE FUNCTION public.complete_booking(p_booking_id text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select public.confirm_booking(p_booking_id)
$function$;
;

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_role text, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user public."User";
  v_profile_id text;
  v_company_id text := nullif(trim(p_payload->>'companyId'),'');
  v_profession_id text := nullif(trim(p_payload->>'professionId'),'');
  v_years integer;
  v_bio text := trim(coalesce(p_payload->>'bio',''));
begin
  if auth.uid() is null or p_role not in ('USER','CONSULTANT') then raise exception 'unauthorized'; end if;
  select * into v_user from public."User" where auth_user_id=auth.uid() for update;
  if v_user.id is null then raise exception 'profile_not_found'; end if;
  if v_user."onboardingCompleted" then return; end if;

  if p_role='CONSULTANT' then
    v_years := greatest(0,least(60,coalesce(nullif(p_payload->>'yearsExperience','')::integer,0)));
    if length(trim(coalesce(p_payload->>'headline',''))) < 3 or length(v_bio) < 30
       or length(trim(coalesce(p_payload->>'location',''))) < 2
       or length(trim(coalesce(p_payload->>'title',''))) < 2
       or not exists(select 1 from public."Company" where id=v_company_id)
       or not exists(select 1 from public."Profession" where id=v_profession_id) then
      raise exception 'invalid_onboarding_data';
    end if;
    v_profile_id := gen_random_uuid()::text;
    insert into public."ProfessionalProfile"(id,"userId",headline,bio,location,region,"workMode",seniority,"yearsExperience","price30Cents","price60Cents","avatarSeed",topics,boundaries,"updatedAt")
    values(v_profile_id,v_user.id,left(trim(p_payload->>'headline'),160),left(v_bio,2000),left(trim(p_payload->>'location'),160),'Brasil','REMOTE','MID',v_years,0,0,auth.uid()::text,'{}','{}',now());
    insert into public."EmploymentExperience"(id,"professionalProfileId","companyId","professionId",title,area,"isCurrent","startedAt",summary)
    values(gen_random_uuid()::text,v_profile_id,v_company_id,v_profession_id,left(trim(p_payload->>'title'),160),'Profissional',true,(current_date - make_interval(years=>v_years))::timestamp,left(v_bio,1000));
    insert into public."PrivacySettings"(id,"professionalProfileId","updatedAt") values(gen_random_uuid()::text,v_profile_id,now());
  end if;
  update public."User" set role=p_role::public."Role", "onboardingCompleted"=true, "updatedAt"=now() where id=v_user.id;
end; $function$;
;

CREATE OR REPLACE FUNCTION public.confirm_booking(p_booking_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user text; v_booking public."Booking";
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 select * into v_booking from public."Booking" where id=p_booking_id for update;
 if v_booking.id is null or v_booking.status not in ('CONFIRMED','AWAITING_CONFIRMATION') then raise exception 'invalid_state'; end if;
 if v_booking."customerId"=v_user then update public."Booking" set "customerConfirmedAt"=now(),status='AWAITING_CONFIRMATION',"updatedAt"=now() where id=p_booking_id;
 elsif exists(select 1 from public."ProfessionalProfile" where id=v_booking."professionalProfileId" and "userId"=v_user) then update public."Booking" set "consultantConfirmedAt"=now(),status='AWAITING_CONFIRMATION',"updatedAt"=now() where id=p_booking_id;
 else raise exception 'not_authorized'; end if;
 if (select "customerConfirmedAt" is not null and "consultantConfirmedAt" is not null from public."Booking" where id=p_booking_id) then
  update public."Booking" set status='COMPLETED',"updatedAt"=now() where id=p_booking_id;
  update public."Payment" set status='RELEASED',"releasedAt"=now(),"updatedAt"=now() where "bookingId"=p_booking_id and status in ('HELD','PAID_HELD');
 end if;
end; $function$;
;

CREATE OR REPLACE FUNCTION public.create_booking(p_profile_id text, p_slot_id text, p_duration integer, p_topics text[], p_goals text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ declare uid text; slot public."Availability"; bid text; price integer; fee integer := 500; begin select id into uid from public."User" where auth_user_id=auth.uid() and role in ('USER','ADMIN'); if uid is null then raise exception 'unauthorized'; end if; if p_duration not in (30,60) then raise exception 'invalid_duration'; end if; select * into slot from public."Availability" where id=p_slot_id and "professionalProfileId"=p_profile_id and "isBooked"=false and "startsAt">now() for update; if slot.id is null or slot."endsAt" < slot."startsAt"+make_interval(mins=>p_duration) then raise exception 'slot_unavailable'; end if; select case when p_duration=60 then "price60Cents" else "price30Cents" end into price from public."ProfessionalProfile" where id=p_profile_id and "isActive"=true; if price is null then raise exception 'profile_not_found'; end if; bid=gen_random_uuid()::text; update public."Availability" set "isBooked"=true where id=p_slot_id and "isBooked"=false; if not found then raise exception 'slot_unavailable'; end if; insert into public."Booking"(id,"customerId","professionalProfileId","availabilityId","startsAt","durationMinutes",topics,goals,status,"subtotalCents","feeCents","totalCents","createdAt","updatedAt") values(bid,uid,p_profile_id,p_slot_id,slot."startsAt",p_duration,coalesce(p_topics,'{}'),coalesce(p_goals,''),'PENDING_PAYMENT'::public."BookingStatus",price,fee,price+fee,now(),now()); insert into public."Conversation"(id,"bookingId","createdAt","updatedAt") values(gen_random_uuid()::text,bid,now(),now()); insert into public."Payment"(id,"bookingId",status,"amountCents","createdAt","updatedAt") values(gen_random_uuid()::text,bid,'PENDING'::public."PaymentStatus",price+fee,now(),now()); return bid; end; $function$;
;

CREATE OR REPLACE FUNCTION public.create_consultant_availability(p_user_id text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_profile_id text;
  v_slot jsonb;
begin
  select pp.id into v_profile_id
  from public."ProfessionalProfile" pp
  join public."User" u on u.id = pp."userId"
  where pp."userId" = p_user_id
    and u."auth_user_id" = v_uid
    and u.role = 'CONSULTANT'::"Role";

  if v_profile_id is null then raise exception 'profile_not_found'; end if;
  if p_starts_at <= now() + interval '15 minutes' or p_ends_at <= p_starts_at then
    raise exception 'invalid_time_range';
  end if;

  if exists (
    select 1 from public."Availability" a
    where a."professionalProfileId" = v_profile_id
      and a."startsAt" < p_ends_at
      and a."endsAt" > p_starts_at
  ) then raise exception 'availability_conflict'; end if;

  insert into public."Availability" (id, "professionalProfileId", "startsAt", "endsAt", "isBooked", "createdAt")
  values (gen_random_uuid()::text, v_profile_id, p_starts_at, p_ends_at, false, now())
  returning to_jsonb("Availability".*) into v_slot;

  return v_slot;
end;
$function$;
;

CREATE OR REPLACE FUNCTION public.create_review(p_booking_id text, p_rating integer, p_comment text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare uid text; b public."Booking";
begin
 select id into uid from public."User" where auth_user_id=auth.uid();
 if uid is null or p_rating not between 1 and 5 or length(trim(p_comment))<12 then raise exception 'invalid_request'; end if;
 select * into b from public."Booking" where id=p_booking_id and "customerId"=uid and status='COMPLETED'::public."BookingStatus";
 if b.id is null or exists(select 1 from public."Review" where "bookingId"=p_booking_id) then raise exception 'not_reviewable'; end if;
 insert into public."Review"(id,"bookingId","userId","professionalProfileId",rating,clarity,usefulness,contextualization,comment,"createdAt")
 values(gen_random_uuid()::text,b.id,uid,b."professionalProfileId",p_rating,p_rating,p_rating,p_rating,trim(p_comment),now());
end; $function$;
;

CREATE OR REPLACE FUNCTION public.create_support_report(p_category text, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v_user text;
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 if v_user is null or length(trim(p_category)) not between 2 and 80 or length(trim(p_description)) not between 20 and 4000 then raise exception 'invalid_request'; end if;
 insert into public."Report"(id,"reporterId",category,description,status,"createdAt","updatedAt")
 values(gen_random_uuid()::text,v_user,trim(p_category),trim(p_description),'OPEN',now(),now());
end; $function$;
;

CREATE OR REPLACE FUNCTION public.dispute_booking(p_booking_id text, p_description text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user text;
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 if length(trim(p_description)) not between 20 and 2000 then raise exception 'invalid_description'; end if;
 update public."Booking" b set status='DISPUTED'::public."BookingStatus","disputedAt"=now(),"disputeReason"=trim(p_description),"updatedAt"=now()
 where b.id=p_booking_id and b.status in ('CONFIRMED','AWAITING_CONFIRMATION') and (b."customerId"=v_user or exists(select 1 from public."ProfessionalProfile" pp where pp.id=b."professionalProfileId" and pp."userId"=v_user));
 if not found then raise exception 'not_authorized_or_invalid_state'; end if;
 update public."Payment" set status='DISPUTED'::public."PaymentStatus","updatedAt"=now() where "bookingId"=p_booking_id;
end; $function$;
;

CREATE OR REPLACE FUNCTION public.escape_like(value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select replace(replace(replace(value,'\','\\'),'%','\%'),'_','\_')
$function$;
;

CREATE OR REPLACE FUNCTION public.get_consultant_dashboard(p_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_auth uuid := auth.uid();
  v_profile public."ProfessionalProfile";
  v_result jsonb;
begin
  if v_auth is null or not exists (
    select 1 from public."User" u
    where u.id = p_user_id and u."auth_user_id" = v_auth and u.role = 'CONSULTANT'::"Role"
  ) then
    raise exception 'not_authorized';
  end if;

  select p.* into v_profile from public."ProfessionalProfile" p where p."userId" = p_user_id;
  if not found then return null; end if;

  select jsonb_build_object(
    'id', v_profile.id,
    'userId', v_profile."userId",
    'headline', v_profile.headline,
    'bio', v_profile.bio,
    'location', v_profile.location,
    'region', v_profile.region,
    'workMode', v_profile."workMode",
    'seniority', v_profile.seniority,
    'yearsExperience', v_profile."yearsExperience",
    'price30Cents', v_profile."price30Cents",
    'price60Cents', v_profile."price60Cents",
    'pixKey', v_profile."pixKey",
    'responseHours', v_profile."responseHours",
    'privacyMode', v_profile."privacyMode",
    'pseudonym', v_profile.pseudonym,
    'avatarSeed', v_profile."avatarSeed",
    'topics', v_profile.topics,
    'boundaries', v_profile.boundaries,
    'verificationStatus', v_profile."verificationStatus",
    'isActive', v_profile."isActive",
    'createdAt', v_profile."createdAt",
    'updatedAt', v_profile."updatedAt",
    'user', (select to_jsonb(u) - 'passwordHash' - 'twoFactorSecret' - 'twoFactorRecoveryCodes' from public."User" u where u.id = p_user_id),
    'privacy', (select to_jsonb(x) from public."PrivacySettings" x where x."professionalProfileId" = v_profile.id),
    'experiences', coalesce((select jsonb_agg(to_jsonb(x) || jsonb_build_object(
      'company', (select to_jsonb(c) from public."Company" c where c.id=x."companyId"),
      'profession', (select to_jsonb(f) from public."Profession" f where f.id=x."professionId")
    ) order by x."isCurrent" desc) from public."EmploymentExperience" x where x."professionalProfileId"=v_profile.id), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(to_jsonb(a) order by a."startsAt") from public."Availability" a where a."professionalProfileId"=v_profile.id and a."endsAt" > now()), '[]'::jsonb),
    'profileViews', coalesce((select jsonb_agg(to_jsonb(v)) from public."ProfileView" v where v."professionalProfileId"=v_profile.id), '[]'::jsonb),
    'favorites', coalesce((select jsonb_agg(to_jsonb(f)) from public."Favorite" f where f."professionalProfileId"=v_profile.id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(b) || jsonb_build_object(
      'customer', (select jsonb_build_object('id',u.id,'name',u.name) from public."User" u where u.id=b."customerId"),
      'payment', (select to_jsonb(pay) from public."Payment" pay where pay."bookingId"=b.id),
      'conversation', (select to_jsonb(c) || jsonb_build_object('messages', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('sender',(select jsonb_build_object('id',su.id,'name',su.name) from public."User" su where su.id=m."senderId")) order by m."createdAt") from public."Message" m where m."conversationId"=c.id), '[]'::jsonb)) from public."Conversation" c where c."bookingId"=b.id)
    ) order by b."startsAt" desc) from public."Booking" b where b."professionalProfileId"=v_profile.id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;
;

CREATE OR REPLACE FUNCTION public.get_viewer_dashboard(p_user_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_auth uuid := auth.uid(); v_result jsonb;
begin
 if v_auth is null or not exists(select 1 from public."User" where id=p_user_id and auth_user_id=v_auth) then raise exception 'not_authorized'; end if;
 select jsonb_build_object(
  'id',u.id,'name',u.name,
  'customerBookings',coalesce((select jsonb_agg(to_jsonb(b)||jsonb_build_object(
    'professional',(select to_jsonb(pc) from public.public_profile_cards pc where pc.id=b."professionalProfileId"),
    'customer',jsonb_build_object('name',u.name),
    'payment',(select to_jsonb(p) from public."Payment" p where p."bookingId"=b.id),
    'review',(select to_jsonb(r) from public."Review" r where r."bookingId"=b.id),
    'conversation',(select to_jsonb(c)||jsonb_build_object('messages',coalesce((select jsonb_agg(to_jsonb(m) order by m."createdAt") from public."Message" m where m."conversationId"=c.id),'[]'::jsonb)) from public."Conversation" c where c."bookingId"=b.id)
  ) order by b."startsAt" desc) from public."Booking" b where b."customerId"=u.id),'[]'::jsonb),
  'favorites',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('professionalProfile',(select to_jsonb(pc) from public.public_profile_cards pc where pc.id=f."professionalProfileId"))) from public."Favorite" f where f."userId"=u.id),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n."createdAt" desc) from public."Notification" n where n."userId"=u.id),'[]'::jsonb)
 ) into v_result from public."User" u where u.id=p_user_id;
 return v_result;
end; $function$;
;

CREATE OR REPLACE FUNCTION public.health_check()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select jsonb_build_object('ok',true) $function$
;

CREATE OR REPLACE FUNCTION public.release_eligible_bookings_for_user()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_user_id text;
  v_count integer := 0;
  b record;
begin
  select id into v_user_id from public."User" where "auth_user_id" = v_uid;
  if v_user_id is null then raise exception 'not_authorized'; end if;

  for b in
    select bk.id, bk."customerId"
    from public."Booking" bk
    join public."ProfessionalProfile" pp on pp.id = bk."professionalProfileId"
    join public."Payment" pay on pay."bookingId" = bk.id
    where pp."userId" = v_user_id
      and bk.status = 'AWAITING_CONFIRMATION'::"BookingStatus"
      and bk."disputedAt" is null
      and pay.status = 'HELD'::"PaymentStatus"
      and coalesce(bk."autoReleaseAt", bk."startsAt" + ((bk."durationMinutes" + 1440) * interval '1 minute')) <= now()
    for update of bk
  loop
    update public."Booking"
      set status = 'COMPLETED'::"BookingStatus",
          "updatedAt" = now()
    where id = b.id;

    update public."Payment"
      set status = 'RELEASED'::"PaymentStatus",
          "releasedAt" = now(),
          "updatedAt" = now()
    where "bookingId" = b.id;

    insert into public."Notification" ("id","userId",title,body,href,"createdAt")
    values
      (gen_random_uuid()::text, v_user_id, 'Repasse liberado', 'O prazo de confirmação terminou sem contestação. O repasse demonstrativo foi liberado.', '/consultor/ganhos', now()),
      (gen_random_uuid()::text, b."customerId", 'Conversa concluída', 'O prazo de confirmação terminou sem contestação.', '/dashboard/avaliacoes', now());

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;
;

CREATE OR REPLACE FUNCTION public.remove_consultant_availability(p_availability_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_user_id text;
  v_profile_id text;
begin
  select id into v_user_id from public."User" where "auth_user_id" = v_uid;
  select pp.id into v_profile_id from public."ProfessionalProfile" pp
    where pp."userId" = v_user_id;
  if v_profile_id is null then raise exception 'profile_not_found'; end if;

  delete from public."Availability" a
   where a.id = p_availability_id
     and a."professionalProfileId" = v_profile_id
     and a."isBooked" = false
     and a."startsAt" > now();

  if not found then raise exception 'availability_not_removable'; end if;
  return v_profile_id;
end;
$function$;
;

CREATE OR REPLACE FUNCTION public.report_booking_payment(p_booking_id text, p_method text DEFAULT 'PIX'::text)
 RETURNS "PaymentStatus"
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_auth uuid := auth.uid();
  v_user public."User";
  v_booking public."Booking";
  v_payment public."Payment";
  v_next public."PaymentStatus" := 'PAYMENT_REPORTED'::public."PaymentStatus";
begin
  if v_auth is null then raise exception 'not_authenticated'; end if;
  select * into v_user from public."User" where "auth_user_id" = v_auth;
  select * into v_booking from public."Booking" where id = p_booking_id for update;
  if v_user.id is null or v_booking."customerId" <> v_user.id then raise exception 'not_authorized'; end if;
  if v_booking.status <> 'PENDING_PAYMENT'::public."BookingStatus" then raise exception 'invalid_booking_state'; end if;
  select * into v_payment from public."Payment" where "bookingId" = p_booking_id for update;
  if v_payment.id is null then raise exception 'payment_not_found'; end if;
  if v_payment.status <> 'PENDING'::public."PaymentStatus" then return v_payment.status; end if;
  update public."Payment" set status = v_next, provider = coalesce(nullif(p_method,''),'PIX'), "updatedAt" = now() where id = v_payment.id;
  update public."Booking" set "paymentReportedAt" = now(), "updatedAt" = now() where id = p_booking_id;
  insert into public."PaymentAuditEvent" ("bookingId","paymentId","actorUserId","actorAuthId","previousBookingStatus","newBookingStatus","previousPaymentStatus","newPaymentStatus",observation)
  values (p_booking_id,v_payment.id,v_user.id,v_auth,v_booking.status,v_booking.status,v_payment.status,v_next,'Pagamento informado pelo cliente');
  return v_next;
end;
$function$;
;

CREATE OR REPLACE FUNCTION public.search_public_profiles(p_query text DEFAULT NULL::text, p_company_slug text DEFAULT NULL::text, p_profession_slug text DEFAULT NULL::text, p_work_mode text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with filtered as (
    select card.*
    from public.public_profile_cards card
    where (p_work_mode is null or card."workMode"::text = upper(p_work_mode))
      and (p_location is null or card.location ilike '%' || public.escape_like(p_location) || '%')
      and (p_query is null or concat_ws(' ',card.headline,card.bio,card.location,array_to_string(card.topics,' ')) ilike '%' || public.escape_like(p_query) || '%')
      and (p_company_slug is null or exists (
        select 1 from public."EmploymentExperience" ee join public."Company" c on c.id=ee."companyId"
        where ee."professionalProfileId"=card.id and c.slug=p_company_slug))
      and (p_profession_slug is null or exists (
        select 1 from public."EmploymentExperience" ee join public."Profession" p on p.id=ee."professionId"
        where ee."professionalProfileId"=card.id and p.slug=p_profession_slug))
  ), counted as (select *, count(*) over() total_count from filtered)
  select coalesce(jsonb_agg(jsonb_build_object('profile',to_jsonb(c)-'total_count','total_count',c.total_count) order by c."verificationStatus"='VERIFIED' desc,c.headline), '[]'::jsonb)
  from (select * from counted limit least(greatest(p_limit,1),50) offset greatest(p_offset,0)) c
$function$;
;

CREATE OR REPLACE FUNCTION public.send_message(p_conversation_id text, p_body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user text; v_booking public."Booking";
begin
 select id into v_user from public."User" where auth_user_id=auth.uid();
 if v_user is null or length(trim(p_body)) not between 1 and 2000 then raise exception 'invalid_message'; end if;
 if p_body ~* '(https?://|www\.|whats?app|instagram|telegram|pix|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}|([0-9]{2}[^0-9]*)?9?[0-9]{4}[^0-9]*[0-9]{4})' then raise exception 'contact_sharing_not_allowed'; end if;
 select b.* into v_booking from public."Conversation" c join public."Booking" b on b.id=c."bookingId" where c.id=p_conversation_id;
 if v_booking.id is null or v_booking.status not in ('CONFIRMED','AWAITING_CONFIRMATION') or now() > v_booking."startsAt"+interval '7 days' or not(v_booking."customerId"=v_user or exists(select 1 from public."ProfessionalProfile" p where p.id=v_booking."professionalProfileId" and p."userId"=v_user)) then raise exception 'not_authorized'; end if;
 if (select count(*) from public."Message" where "senderId"=v_user and "createdAt">now()-interval '1 minute')>=10 then raise exception 'rate_limited'; end if;
 insert into public."Message"(id,"conversationId","senderId",body,"createdAt") values(gen_random_uuid()::text,p_conversation_id,v_user,trim(p_body),now());
end; $function$;
;

CREATE OR REPLACE FUNCTION public.set_recording_consent(p_booking_id text, p_consented boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 update public."Booking" b set "consultantRecordingConsent"=p_consented,"updatedAt"=now()
 where b.id=p_booking_id and exists(select 1 from public."ProfessionalProfile" pp join public."User" u on u.id=pp."userId" where pp.id=b."professionalProfileId" and u.auth_user_id=auth.uid());
 if not found then raise exception 'not_authorized'; end if;
end; $function$;
;

CREATE OR REPLACE FUNCTION public.submit_verification(p_storage_key text, p_original_name text, p_mime_type text, p_size_bytes integer, p_method text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_profile_id text; v_verification_id text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select p.id into v_profile_id from public."ProfessionalProfile" p join public."User" u on u.id=p."userId"
    where u.auth_user_id=auth.uid() and u.role='CONSULTANT';
  if v_profile_id is null then raise exception 'consultant_required'; end if;
  if p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp') or p_size_bytes<1 or p_size_bytes>5242880
     or p_storage_key not like auth.uid()::text||'/%' or length(p_original_name)<1 or length(p_original_name)>120
     or p_method not in ('company_email','employment_document','professional_reference') then raise exception 'invalid_document'; end if;
  if exists(select 1 from public."Verification" where "professionalProfileId"=v_profile_id and status='PENDING') then raise exception 'verification_pending'; end if;
  v_verification_id:=gen_random_uuid()::text;
  insert into public."Verification"(id,"professionalProfileId",method,status,"updatedAt") values(v_verification_id,v_profile_id,p_method,'PENDING',now());
  insert into public."VerificationDocument"(id,"verificationId","storageKey","originalName","mimeType","sizeBytes")
    values(gen_random_uuid()::text,v_verification_id,p_storage_key,p_original_name,p_mime_type,p_size_bytes);
  update public."ProfessionalProfile" set "verificationStatus"='PENDING',"updatedAt"=now() where id=v_profile_id;
end; $function$;
;

CREATE OR REPLACE FUNCTION public.sync_google_profile(p_name text, p_image text)
 RETURNS TABLE(role text, "onboardingCompleted" boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(auth.jwt()->>'email'));
  v_role "Role";
  v_onboarding boolean;
begin
  if v_uid is null or v_email is null or v_email = '' then
    raise exception 'invalid_auth_context';
  end if;

  update public."User"
  set "auth_user_id" = v_uid,
      name = coalesce(nullif(trim(p_name), ''), name),
      image = coalesce(p_image, image),
      "updatedAt" = now()
  where lower(email) = v_email
    and ("auth_user_id" is null or "auth_user_id" = v_uid);

  if not found then
    insert into public."User" (id, name, email, image, "auth_user_id", "updatedAt")
    values (gen_random_uuid()::text, coalesce(nullif(trim(p_name), ''), 'Pessoa Insidely'), v_email, p_image, v_uid, now())
    on conflict (auth_user_id) do update
      set name = excluded.name, image = coalesce(excluded.image, public."User".image), "updatedAt" = now();
  end if;

  select u.role, u."onboardingCompleted" into v_role, v_onboarding
    from public."User" u where u."auth_user_id" = v_uid;

  if v_role is null then raise exception 'profile_sync_failed'; end if;
  return query select v_role::text, v_onboarding;
end;
$function$;
;

CREATE OR REPLACE FUNCTION public.sync_social_profile(p_name text, p_image text)
 RETURNS TABLE(role text, "onboardingCompleted" boolean)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 select * from public.sync_google_profile(p_name,p_image)
$function$;
;

CREATE OR REPLACE FUNCTION public.toggle_favorite(p_profile_id text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare uid text;
begin
 select id into uid from public."User" where auth_user_id=auth.uid();
 if uid is null then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public."ProfessionalProfile" where id=p_profile_id and "isActive"=true) then raise exception 'profile_not_found'; end if;
 if exists(select 1 from public."Favorite" where "userId"=uid and "professionalProfileId"=p_profile_id) then
   delete from public."Favorite" where "userId"=uid and "professionalProfileId"=p_profile_id;
 else
   insert into public."Favorite"(id,"userId","professionalProfileId","createdAt") values(gen_random_uuid()::text,uid,p_profile_id,now());
 end if;
end; $function$;
;

CREATE OR REPLACE FUNCTION public.update_privacy(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_profile_id text;
begin
  select pp.id into v_profile_id from public."ProfessionalProfile" pp join public."User" u on u.id=pp."userId"
  where u.auth_user_id=(select auth.uid()) and u.role='CONSULTANT'::public."Role";
  if v_profile_id is null then raise exception 'profile_not_found'; end if;
  update public."PrivacySettings" set
    "showRealName"=coalesce((p_payload->>'showRealName')::boolean,"showRealName"),
    "showSurname"=coalesce((p_payload->>'showSurname')::boolean,"showSurname"),
    "showPhoto"=coalesce((p_payload->>'showPhoto')::boolean,"showPhoto"),
    "showCurrentCompany"=coalesce((p_payload->>'showCurrentCompany')::boolean,"showCurrentCompany"),
    "showCity"=coalesce((p_payload->>'showCity')::boolean,"showCity"),
    "showExactDates"=coalesce((p_payload->>'showExactDates')::boolean,"showExactDates"),
    "showFullHistory"=coalesce((p_payload->>'showFullHistory')::boolean,"showFullHistory"),
    "searchableByCompany"=coalesce((p_payload->>'searchableByCompany')::boolean,"searchableByCompany"),
    "searchableByProfession"=coalesce((p_payload->>'searchableByProfession')::boolean,"searchableByProfession"),
    "updatedAt"=now() where "professionalProfileId"=v_profile_id;
  if not found then raise exception 'privacy_settings_not_found'; end if;
end; $function$
;

CREATE OR REPLACE FUNCTION public.update_professional_profile(p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_profile_id text; v_experience_id text;
begin
 select pp.id into v_profile_id from public."User" u join public."ProfessionalProfile" pp on pp."userId"=u.id where u.auth_user_id=(select auth.uid()) and u.role='CONSULTANT'::public."Role";
 if v_profile_id is null then raise exception 'profile_not_found'; end if;
 update public."ProfessionalProfile" set headline=coalesce(p_payload->>'headline',headline),bio=coalesce(p_payload->>'bio',bio),location=coalesce(p_payload->>'location',location),region=coalesce(p_payload->>'region',region),"workMode"=coalesce(p_payload->>'workMode',"workMode"::text)::public."WorkMode",seniority=coalesce(p_payload->>'seniority',seniority::text)::public."Seniority","yearsExperience"=coalesce(nullif(p_payload->>'yearsExperience','')::integer,"yearsExperience"),"price30Cents"=coalesce(nullif(p_payload->>'price30Cents','')::integer,"price30Cents"),"price60Cents"=coalesce(nullif(p_payload->>'price60Cents','')::integer,"price60Cents"),"responseHours"=coalesce(nullif(p_payload->>'responseHours','')::integer,"responseHours"),"pixKey"=nullif(p_payload->>'pixKey',''),topics=string_to_array(nullif(p_payload->>'topics',''),', '),boundaries=string_to_array(nullif(p_payload->>'boundaries',''),', '),"updatedAt"=now() where id=v_profile_id;
 select id into v_experience_id from public."EmploymentExperience" where "professionalProfileId"=v_profile_id order by "createdAt" limit 1;
 if v_experience_id is null then insert into public."EmploymentExperience"(id,"professionalProfileId","companyId","professionId",title,"isCurrent","createdAt") values(gen_random_uuid()::text,v_profile_id,p_payload->>'companyId',p_payload->>'professionId',coalesce(p_payload->>'title',''),true,now());
 else update public."EmploymentExperience" set "companyId"=coalesce(nullif(p_payload->>'companyId',''),"companyId"),"professionId"=coalesce(nullif(p_payload->>'professionId',''),"professionId"),title=coalesce(nullif(p_payload->>'title',''),title) where id=v_experience_id; end if;
end; $function$
;

CREATE OR REPLACE FUNCTION public.update_profile_image(p_image text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public."User" set image = p_image, "updatedAt" = now()
  where auth_user_id = (select auth.uid());
  if not found then raise exception 'user_not_found'; end if;
end;
$function$;
;



alter table public."Account" enable row level security;
alter table public."AccountDeletionAudit" enable row level security;
alter table public."AuditLog" enable row level security;
alter table public."Availability" enable row level security;
alter table public."Booking" enable row level security;
alter table public."Company" enable row level security;
alter table public."Conversation" enable row level security;
alter table public."EmploymentExperience" enable row level security;
alter table public."Favorite" enable row level security;
alter table public."Message" enable row level security;
alter table public."Notification" enable row level security;
alter table public."Payment" enable row level security;
alter table public."PaymentAuditEvent" enable row level security;
alter table public."PrivacySettings" enable row level security;
alter table public."Profession" enable row level security;
alter table public."ProfessionalProfile" enable row level security;
alter table public."ProfileView" enable row level security;
alter table public."RealityCheck" enable row level security;
alter table public."Report" enable row level security;
alter table public."Review" enable row level security;
alter table public."Session" enable row level security;
alter table public."User" enable row level security;
alter table public."Verification" enable row level security;
alter table public."VerificationDocument" enable row level security;
alter table public."VerificationToken" enable row level security;

drop policy if exists "audit deny client reads" on public."AccountDeletionAudit";
create policy "audit deny client reads" on public."AccountDeletionAudit" as RESTRICTIVE for SELECT to authenticated using (false);
drop policy if exists booking_customer_insert on public."Booking";
create policy booking_customer_insert on public."Booking" as PERMISSIVE for INSERT to authenticated with check (("customerId" = ( SELECT "User".id
   FROM "User"
  WHERE ("User".auth_user_id = auth.uid()))));
drop policy if exists public_company_read on public."Company";
create policy public_company_read on public."Company" as PERMISSIVE for SELECT to anon, authenticated using (true);
drop policy if exists favorite_owner_access on public."Favorite";
create policy favorite_owner_access on public."Favorite" as PERMISSIVE for ALL to authenticated using (("userId" = ( SELECT u.id
   FROM "User" u
  WHERE (u.auth_user_id = ( SELECT auth.uid() AS uid))))) with check (("userId" = ( SELECT u.id
   FROM "User" u
  WHERE (u.auth_user_id = ( SELECT auth.uid() AS uid)))));
drop policy if exists message_participant_insert on public."Message";
create policy message_participant_insert on public."Message" as PERMISSIVE for INSERT to authenticated with check ((("senderId" = ( SELECT "User".id
   FROM "User"
  WHERE ("User".auth_user_id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM (("Conversation" c
     JOIN "Booking" b ON ((b.id = c."bookingId")))
     LEFT JOIN "ProfessionalProfile" p ON ((p.id = b."professionalProfileId")))
  WHERE ((c.id = "Message"."conversationId") AND ((b."customerId" = "Message"."senderId") OR (p."userId" = "Message"."senderId")))))));
drop policy if exists "payment audit participants read" on public."PaymentAuditEvent";
create policy "payment audit participants read" on public."PaymentAuditEvent" as PERMISSIVE for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM ("Booking" b
     JOIN "User" u ON ((u.auth_user_id = ( SELECT auth.uid() AS uid))))
  WHERE ((b.id = "PaymentAuditEvent"."bookingId") AND ((b."customerId" = u.id) OR (EXISTS ( SELECT 1
           FROM "ProfessionalProfile" pp
          WHERE ((pp.id = b."professionalProfileId") AND (pp."userId" = u.id)))) OR (u.role = 'ADMIN'::"Role"))))));
drop policy if exists "Public can read professions" on public."Profession";
create policy "Public can read professions" on public."Profession" as PERMISSIVE for SELECT to anon, authenticated using (true);
drop policy if exists public_profession_read on public."Profession";
create policy public_profession_read on public."Profession" as PERMISSIVE for SELECT to anon, authenticated using (true);
drop policy if exists professional_active_lookup on public."ProfessionalProfile";
create policy professional_active_lookup on public."ProfessionalProfile" as PERMISSIVE for SELECT to authenticated using (("isActive" = true));
drop policy if exists "Public can read reality checks" on public."RealityCheck";
create policy "Public can read reality checks" on public."RealityCheck" as PERMISSIVE for SELECT to anon, authenticated using (true);
drop policy if exists review_customer_insert on public."Review";
create policy review_customer_insert on public."Review" as PERMISSIVE for INSERT to authenticated with check ((("userId" = ( SELECT "User".id
   FROM "User"
  WHERE ("User".auth_user_id = auth.uid()))) AND (EXISTS ( SELECT 1
   FROM "Booking" b
  WHERE ((b.id = "Review"."bookingId") AND (b."customerId" = "Review"."userId") AND (b.status = 'COMPLETED'::"BookingStatus"))))));
drop policy if exists user_can_read_own_auth_profile on public."User";
create policy user_can_read_own_auth_profile on public."User" as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = auth_user_id));
drop policy if exists user_self_update on public."User";
create policy user_self_update on public."User" as PERMISSIVE for UPDATE to authenticated using ((auth_user_id = auth.uid())) with check ((auth_user_id = auth.uid()));

grant SELECT on table public."Company" to anon;
grant SELECT on table public."Company" to authenticated;
grant DELETE on table public."Favorite" to authenticated;
grant INSERT on table public."Favorite" to authenticated;
grant SELECT on table public."Favorite" to authenticated;
grant DELETE on table public."PaymentAuditEvent" to anon;
grant INSERT on table public."PaymentAuditEvent" to anon;
grant REFERENCES on table public."PaymentAuditEvent" to anon;
grant SELECT on table public."PaymentAuditEvent" to anon;
grant TRIGGER on table public."PaymentAuditEvent" to anon;
grant TRUNCATE on table public."PaymentAuditEvent" to anon;
grant UPDATE on table public."PaymentAuditEvent" to anon;
grant DELETE on table public."PaymentAuditEvent" to authenticated;
grant INSERT on table public."PaymentAuditEvent" to authenticated;
grant REFERENCES on table public."PaymentAuditEvent" to authenticated;
grant SELECT on table public."PaymentAuditEvent" to authenticated;
grant TRIGGER on table public."PaymentAuditEvent" to authenticated;
grant TRUNCATE on table public."PaymentAuditEvent" to authenticated;
grant UPDATE on table public."PaymentAuditEvent" to authenticated;
grant SELECT on table public."Profession" to anon;
grant SELECT on table public."Profession" to authenticated;
grant SELECT on table public."RealityCheck" to anon;
grant SELECT on table public."RealityCheck" to authenticated;
grant SELECT on table public."User" to authenticated;
grant DELETE on table public.home_metrics to anon;
grant INSERT on table public.home_metrics to anon;
grant REFERENCES on table public.home_metrics to anon;
grant SELECT on table public.home_metrics to anon;
grant TRIGGER on table public.home_metrics to anon;
grant TRUNCATE on table public.home_metrics to anon;
grant UPDATE on table public.home_metrics to anon;
grant DELETE on table public.home_metrics to authenticated;
grant INSERT on table public.home_metrics to authenticated;
grant REFERENCES on table public.home_metrics to authenticated;
grant SELECT on table public.home_metrics to authenticated;
grant TRIGGER on table public.home_metrics to authenticated;
grant TRUNCATE on table public.home_metrics to authenticated;
grant UPDATE on table public.home_metrics to authenticated;
grant DELETE on table public.public_company_cards to anon;
grant INSERT on table public.public_company_cards to anon;
grant REFERENCES on table public.public_company_cards to anon;
grant SELECT on table public.public_company_cards to anon;
grant TRIGGER on table public.public_company_cards to anon;
grant TRUNCATE on table public.public_company_cards to anon;
grant UPDATE on table public.public_company_cards to anon;
grant DELETE on table public.public_company_cards to authenticated;
grant INSERT on table public.public_company_cards to authenticated;
grant REFERENCES on table public.public_company_cards to authenticated;
grant SELECT on table public.public_company_cards to authenticated;
grant TRIGGER on table public.public_company_cards to authenticated;
grant TRUNCATE on table public.public_company_cards to authenticated;
grant UPDATE on table public.public_company_cards to authenticated;
grant DELETE on table public.public_company_details to anon;
grant INSERT on table public.public_company_details to anon;
grant REFERENCES on table public.public_company_details to anon;
grant SELECT on table public.public_company_details to anon;
grant TRIGGER on table public.public_company_details to anon;
grant TRUNCATE on table public.public_company_details to anon;
grant UPDATE on table public.public_company_details to anon;
grant DELETE on table public.public_company_details to authenticated;
grant INSERT on table public.public_company_details to authenticated;
grant REFERENCES on table public.public_company_details to authenticated;
grant SELECT on table public.public_company_details to authenticated;
grant TRIGGER on table public.public_company_details to authenticated;
grant TRUNCATE on table public.public_company_details to authenticated;
grant UPDATE on table public.public_company_details to authenticated;
grant DELETE on table public.public_profession_cards to anon;
grant INSERT on table public.public_profession_cards to anon;
grant REFERENCES on table public.public_profession_cards to anon;
grant SELECT on table public.public_profession_cards to anon;
grant TRIGGER on table public.public_profession_cards to anon;
grant TRUNCATE on table public.public_profession_cards to anon;
grant UPDATE on table public.public_profession_cards to anon;
grant DELETE on table public.public_profession_cards to authenticated;
grant INSERT on table public.public_profession_cards to authenticated;
grant REFERENCES on table public.public_profession_cards to authenticated;
grant SELECT on table public.public_profession_cards to authenticated;
grant TRIGGER on table public.public_profession_cards to authenticated;
grant TRUNCATE on table public.public_profession_cards to authenticated;
grant UPDATE on table public.public_profession_cards to authenticated;
grant DELETE on table public.public_profession_details to anon;
grant INSERT on table public.public_profession_details to anon;
grant REFERENCES on table public.public_profession_details to anon;
grant SELECT on table public.public_profession_details to anon;
grant TRIGGER on table public.public_profession_details to anon;
grant TRUNCATE on table public.public_profession_details to anon;
grant UPDATE on table public.public_profession_details to anon;
grant DELETE on table public.public_profession_details to authenticated;
grant INSERT on table public.public_profession_details to authenticated;
grant REFERENCES on table public.public_profession_details to authenticated;
grant SELECT on table public.public_profession_details to authenticated;
grant TRIGGER on table public.public_profession_details to authenticated;
grant TRUNCATE on table public.public_profession_details to authenticated;
grant UPDATE on table public.public_profession_details to authenticated;
grant DELETE on table public.public_profile_cards to anon;
grant INSERT on table public.public_profile_cards to anon;
grant REFERENCES on table public.public_profile_cards to anon;
grant SELECT on table public.public_profile_cards to anon;
grant TRIGGER on table public.public_profile_cards to anon;
grant TRUNCATE on table public.public_profile_cards to anon;
grant UPDATE on table public.public_profile_cards to anon;
grant DELETE on table public.public_profile_cards to authenticated;
grant INSERT on table public.public_profile_cards to authenticated;
grant REFERENCES on table public.public_profile_cards to authenticated;
grant SELECT on table public.public_profile_cards to authenticated;
grant TRIGGER on table public.public_profile_cards to authenticated;
grant TRUNCATE on table public.public_profile_cards to authenticated;
grant UPDATE on table public.public_profile_cards to authenticated;

grant execute on function admin_confirm_booking_payment(text,text) to authenticated;
grant execute on function admin_resolve_report(text,text) to authenticated;
grant execute on function complete_booking(text) to authenticated;
grant execute on function complete_onboarding(text,jsonb) to authenticated;
grant execute on function confirm_booking(text) to authenticated;
grant execute on function create_booking(text,text,integer,text[],text) to authenticated;
grant execute on function create_consultant_availability(text,timestamp with time zone,timestamp with time zone) to authenticated;
grant execute on function create_review(text,integer,text) to authenticated;
grant execute on function create_support_report(text,text) to authenticated;
grant execute on function dispute_booking(text,text) to authenticated;
grant execute on function escape_like(text) to anon;
grant execute on function escape_like(text) to authenticated;
grant execute on function get_consultant_dashboard(text) to authenticated;
grant execute on function get_viewer_dashboard(text) to authenticated;
grant execute on function health_check() to anon;
grant execute on function health_check() to authenticated;
grant execute on function release_eligible_bookings_for_user() to authenticated;
grant execute on function remove_consultant_availability(text) to authenticated;
grant execute on function report_booking_payment(text,text) to authenticated;
grant execute on function search_public_profiles(text,text,text,text,text,integer,integer) to anon;
grant execute on function search_public_profiles(text,text,text,text,text,integer,integer) to authenticated;
grant execute on function send_message(text,text) to authenticated;
grant execute on function set_recording_consent(text,boolean) to authenticated;
grant execute on function submit_verification(text,text,text,integer,text) to authenticated;
grant execute on function sync_google_profile(text,text) to authenticated;
grant execute on function sync_social_profile(text,text) to authenticated;
grant execute on function toggle_favorite(text) to authenticated;
grant execute on function update_privacy(jsonb) to authenticated;
grant execute on function update_professional_profile(jsonb) to authenticated;
grant execute on function update_profile_image(text) to authenticated;
