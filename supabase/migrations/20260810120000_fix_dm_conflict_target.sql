-- Fixes "تعذّر فتح المحادثة" — every attempt to open a direct conversation
-- failed.
--
-- Cause: conversations_dm_key_idx was created as a PARTIAL unique index
-- (`where dm_key is not null`), but get_or_create_dm infers the conflict
-- target as plain `on conflict (dm_key)`. PostgreSQL cannot match a partial
-- index from a bare inference clause and raises
--
--   there is no unique or exclusion constraint matching the ON CONFLICT
--   specification
--
-- so the insert threw before a conversation was ever created.
--
-- Two fixes were possible: repeat the predicate at every call site
-- (`on conflict (dm_key) where dm_key is not null`), or drop the predicate
-- from the index. The second is taken here because it removes the trap
-- entirely rather than requiring every future writer to remember it.
--
-- Dropping the predicate is safe: PostgreSQL treats NULLs as distinct in a
-- unique index, so the record-attached threads — which all carry
-- dm_key = null — remain unconstrained exactly as before.

drop index if exists public.conversations_dm_key_idx;

create unique index conversations_dm_key_idx
  on public.conversations (dm_key);

-- Verification — expect one row, and `indexdef` must NOT contain "WHERE":
--   select indexdef from pg_indexes where indexname = 'conversations_dm_key_idx';
--
-- Then, from the app, opening a conversation should succeed. To test the
-- constraint still holds, run this twice with the same argument — it must
-- return the same uuid both times:
--   select public.get_or_create_dm('<another-user-uuid>');
