-- When each participant last opened a conversation (/conversa/[id]); messages from the other side
-- after that moment are counted as unread on the cards of /dashboard/mensagens and /consultor/consultas.
create table if not exists public."ConversationRead" (
  "conversationId" text not null references public."Conversation"(id) on delete cascade,
  "userId" text not null references public."User"(id) on delete cascade,
  "lastReadAt" timestamp(3) without time zone not null default now(),
  primary key ("conversationId", "userId")
);
alter table public."ConversationRead" enable row level security;
revoke all on public."ConversationRead" from public, anon, authenticated;
