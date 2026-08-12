-- Internal chat between users of the system.
--
-- Two product decisions are baked in here, both taken deliberately:
--
--   Anyone can message anyone. There is no role check on starting a
--   conversation — only on reading one. The single rule is: you can read a
--   conversation if and only if you are a member of it.
--
--   A conversation may be attached to a deal or a lead. That link is what
--   stops the discussion from drifting away from the record it belongs to,
--   which is the usual failure mode of chat bolted onto a CRM.
--
-- Type note, learned the hard way on the previous migration: deals.id is text
-- and leads.id may be numeric. A single foreign key cannot point at both, so
-- subject_id is a plain text column with NO foreign key — this is a genuine
-- polymorphic reference, which is exactly the case where an FK is impossible.
-- The user columns reference auth.users, whose id is always uuid.

-- ── Tables ───────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('dm', 'deal', 'lead')),

  -- Attached record. Null for a direct message. No FK — see the type note.
  subject_type    text check (subject_type in ('deal', 'lead')),
  subject_id      text,

  -- Both participants' ids, sorted and joined by ':'. A unique index on this
  -- is what guarantees two people never end up with two separate DM threads,
  -- no matter which of them started it or how simultaneously.
  dm_key          text,

  created_by      uuid not null references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),

  -- Stored, not computed. The conversation list sorts by this on every load,
  -- and an aggregate over messages gets slow fast.
  last_message_at timestamptz not null default now(),

  constraint conversations_dm_shape check (
    (kind = 'dm'  and dm_key is not null and subject_id is null)
    or (kind <> 'dm' and dm_key is null  and subject_id is not null)
  )
);

create unique index if not exists conversations_dm_key_idx
  on public.conversations (dm_key) where dm_key is not null;
create index if not exists conversations_subject_idx
  on public.conversations (subject_type, subject_id) where subject_id is not null;
create index if not exists conversations_recent_idx
  on public.conversations (last_message_at desc);


create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  joined_at       timestamptz not null default now(),

  -- One column instead of a read-receipt row per message. We do not need to
  -- know exactly who read which message, and the size difference is enormous.
  last_read_at    timestamptz not null default now(),
  muted           boolean not null default false,

  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id, conversation_id);


create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references auth.users (id) on delete set null,
  body            text not null check (length(btrim(body)) between 1 and 4000),
  created_at      timestamptz not null default now(),

  -- Soft delete, consistent with the rest of the system.
  deleted_at      timestamptz
);

-- The only query that matters: one conversation's messages, newest first.
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at desc);


-- ── The recursion breaker ────────────────────────────────────────────────
-- If the messages policy asks conversation_members, and the members policy
-- asks back, Postgres raises "infinite recursion detected in policy" and every
-- query fails. A security-definer function bypasses RLS internally, so it does
-- not re-enter the policy that called it. Every policy below goes through it.
--
-- `set search_path` is mandatory on any definer function: without it a caller
-- can shadow the tables this function resolves.
create or replace function public.is_conversation_member(conv uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;


-- ── Row level security ───────────────────────────────────────────────────
alter table public.conversations        enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages             enable row level security;

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id));

-- Anyone may start a conversation, but only in their own name.
drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (created_by = auth.uid());

-- No update or delete from the client. last_message_at is maintained by a
-- definer trigger, and conversations are not deleted from the UI.

drop policy if exists members_select on public.conversation_members;
create policy members_select on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- Add yourself, or add someone to a conversation you created.
drop policy if exists members_insert on public.conversation_members;
create policy members_insert on public.conversation_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = auth.uid()
    )
  );

-- Your own row only — last_read_at and muted. Nobody marks anyone else's
-- messages as read.
drop policy if exists members_update on public.conversation_members;
create policy members_update on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

-- Both conditions are required: the first stops sender spoofing, the second
-- stops injecting into a conversation you are not in.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

-- Soft-delete your own messages only.
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());


-- ── Helpers ──────────────────────────────────────────────────────────────

-- Opening a DM must be idempotent under a race: if two people click "message"
-- on each other at the same instant, they must land in the same thread.
create or replace function public.get_or_create_dm(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me   uuid := auth.uid();
  key  text;
  conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if other_user is null then raise exception 'other_user is required'; end if;
  if other_user = me then raise exception 'cannot start a conversation with yourself'; end if;

  -- Sorting makes the key identical regardless of who initiates.
  key := least(me::text, other_user::text) || ':' || greatest(me::text, other_user::text);

  select id into conv from conversations where dm_key = key;
  if conv is not null then return conv; end if;

  insert into conversations (kind, dm_key, created_by)
  values ('dm', key, me)
  on conflict (dm_key) do nothing
  returning id into conv;

  -- Nothing returned means the other side won the race; use theirs.
  if conv is null then
    select id into conv from conversations where dm_key = key;
    return conv;
  end if;

  insert into conversation_members (conversation_id, user_id)
  values (conv, me), (conv, other_user)
  on conflict do nothing;

  return conv;
end;
$$;

grant execute on function public.get_or_create_dm(uuid) to authenticated;


-- Same idea for a record-attached thread: one conversation per deal or lead.
create or replace function public.get_or_create_subject_thread(
  p_subject_type text,
  p_subject_id   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me   uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_subject_type not in ('deal', 'lead') then
    raise exception 'subject_type must be deal or lead';
  end if;

  select id into conv from conversations
   where subject_type = p_subject_type and subject_id = p_subject_id
   limit 1;

  if conv is null then
    insert into conversations (kind, subject_type, subject_id, created_by)
    values (p_subject_type, p_subject_type, p_subject_id, me)
    returning id into conv;
  end if;

  -- Joining is what subscribes you; the thread is open to anyone who opens it.
  insert into conversation_members (conversation_id, user_id)
  values (conv, me)
  on conflict do nothing;

  return conv;
end;
$$;

grant execute on function public.get_or_create_subject_thread(text, text) to authenticated;


create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update conversations set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();


-- Every unread count in one call. The alternative — a query per conversation —
-- is what makes chat sidebars slow.
create or replace function public.unread_counts()
returns table (conversation_id uuid, unread bigint)
language sql
security definer
stable
set search_path = public
as $$
  select m.conversation_id, count(msg.id)
    from conversation_members m
    left join messages msg
      on msg.conversation_id = m.conversation_id
     and msg.created_at > m.last_read_at
     and msg.sender_id <> m.user_id
     and msg.deleted_at is null
   where m.user_id = auth.uid()
   group by m.conversation_id;
$$;

grant execute on function public.unread_counts() to authenticated;


-- ── Realtime ─────────────────────────────────────────────────────────────
-- Without this the client subscribes successfully and simply never receives
-- anything, with no error anywhere. Realtime respects RLS, so a policy problem
-- also shows up as silence rather than as a permission error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$$;


-- ── Verification ─────────────────────────────────────────────────────────
--   select policyname, tablename from pg_policies
--    where tablename in ('conversations','conversation_members','messages')
--    order by tablename, policyname;                       -- expect 8 rows
--
--   select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename = 'messages';   -- 1 row
--
--   select public.get_or_create_dm('<another-user-uuid>');  -- returns a uuid
