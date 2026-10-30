-- What consultants tell about their area, aggregated on the profession page: salary range of the
-- role, one good and one hard thing about the day-to-day.
alter table public."ProfessionalProfile" add column if not exists "salaryRange" text check ("salaryRange" is null or "salaryRange" in ('ATE_3K','3K_6K','6K_10K','10K_15K','15K_25K','ACIMA_25K'));
alter table public."ProfessionalProfile" add column if not exists "areaPro" text check ("areaPro" is null or length("areaPro") <= 200);
alter table public."ProfessionalProfile" add column if not exists "areaCon" text check ("areaCon" is null or length("areaCon") <= 200);
-- Last "your agenda is empty" reminder, at most one a week.
alter table public."ProfessionalProfile" add column if not exists "emptyAgendaRemindedAt" timestamp(3) without time zone;
