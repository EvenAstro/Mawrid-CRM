-- @mention support for internal chat.
--
-- Mentions are recorded as an array of profile ids on the message itself
-- rather than a join table — a message never gains or loses mentions after
-- it's sent, so there's nothing a join table would give us beyond an extra
-- join on every read. The API route that emails mentioned users reads this
-- column directly.

alter table public.messages
  add column if not exists mentions uuid[] not null default '{}';

-- Lets a mentioned user's own notification feed (or the API route) find
-- "messages that mention me" without scanning every row.
create index if not exists messages_mentions_gin_idx
  on public.messages using gin (mentions);

-- Verify:
--   select column_name from information_schema.columns
--   where table_name = 'messages' and column_name = 'mentions';
