ALTER TABLE "Booking"
  ADD COLUMN "meetingProvider" TEXT NOT NULL DEFAULT 'GOOGLE_MEET',
  ADD COLUMN "meetingUrl" TEXT,
  ADD COLUMN "customerRecordingConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consultantRecordingConsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "customerJoinedAt" TIMESTAMP(3),
  ADD COLUMN "consultantJoinedAt" TIMESTAMP(3),
  ADD COLUMN "meetingEndedAt" TIMESTAMP(3);
