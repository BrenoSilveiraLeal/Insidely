-- Read receipts: when the recipient opens the conversation (or is on it when a message arrives),
-- their unread messages get "readAt". Participants already read Message through RLS and realtime,
-- so the sender sees "Lida às HH:MM" live through the UPDATE event.
alter table public."Message" add column if not exists "readAt" timestamp(3) without time zone;
create index if not exists message_unread_idx on public."Message" ("conversationId") where "readAt" is null;
