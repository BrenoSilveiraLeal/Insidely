-- AvailabilityWatch referenced both User and ProfessionalProfile, which made the Data API see a
-- second path between those two tables and refuse every ProfessionalProfile <-> User embed
-- ("more than one relationship was found"). The profile reference stays as plain text: watches are
-- removed when the consultant opens slots, and a missing profile simply never notifies.
alter table public."AvailabilityWatch" drop constraint if exists "AvailabilityWatch_professionalProfileId_fkey";
notify pgrst, 'reload schema';
