-- Group conversations and file attachments.
--
-- The members table was always a join table, so groups need no structural
-- change — only a name to display and a kind to branch on. Attachments are
-- new: this project had never used Supabase Storage.

-- ── Groups ───────────────────────────────────────────────────────────────
alter table public.conversations
  add column if not exists title text;

-- Widen the kind check to admit 'group'.
alter table public.conversations drop constraint if exists conversations_kind_check;
alter table public.conversations
  add constraint conversations_kind_check
  check (kind in ('dm', 'group', 'deal', 'lead'));

-- The shape rule has to admit groups too: a group has a title, no dm_key and
-- no subject.
alter table public.conversations drop constraint if exists conversations_dm_shape;
alter table public.conversations
  add constraint conversations_shape check (
    (kind = 'dm'    and dm_key is not null and subject_id is null)
    or (kind = 'group' and dm_key is null and subject_id is null and title is not null)
    or (kind in ('deal', 'lead') and dm_key is null and subject_id is not null)
  );

-- Creating a group and seeding its members must be one atomic step, or a
-- failure halfway leaves a conversation nobody can see — not even its author,
-- because visibility is membership.
create or replace function public.create_group(p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me   uuid := auth.uid();
  conv uuid;
  uid  uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if btrim(coalesce(p_title, '')) = '' then raise exception 'group title is required'; end if;

  insert into conversations (kind, title, created_by)
  values ('group', btrim(p_title), me)
  returning id into conv;

  insert into conversation_members (conversation_id, user_id)
  values (conv, me)
  on conflict do nothing;

  foreach uid in array coalesce(p_member_ids, '{}')
  loop
    if uid <> me then
      insert into conversation_members (conversation_id, user_id)
      values (conv, uid)
      on conflict do nothing;
    end if;
  end loop;

  return conv;
end;
$$;

grant execute on function public.create_group(text, uuid[]) to authenticated;

-- Anyone already in a group may add someone else to it. Kept deliberately
-- open, matching the "anyone can message anyone" decision — a closed group in
-- a five-person sales team is friction without a threat model behind it.
create or replace function public.add_group_member(p_conversation_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_conversation_member(p_conversation_id) then
    raise exception 'not a member of this conversation';
  end if;
  insert into conversation_members (conversation_id, user_id)
  values (p_conversation_id, p_user_id)
  on conflict do nothing;
end;
$$;

grant execute on function public.add_group_member(uuid, uuid) to authenticated;

-- Leaving is the one destructive action a member has over their own row.
create or replace function public.leave_conversation(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from conversation_members
   where conversation_id = p_conversation_id and user_id = auth.uid();
$$;

grant execute on function public.leave_conversation(uuid) to authenticated;


-- ── Attachments ──────────────────────────────────────────────────────────
-- The file itself lives in Storage; these columns are the pointer plus enough
-- metadata to render a row without fetching the object first.
--
-- `body` stays NOT NULL, so an attachment-only message carries the file name
-- as its body. That keeps search, previews and notifications working without
-- a special case for "a message with no text".
alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_type text,
  add column if not exists attachment_size bigint;

-- Private bucket: objects are reachable only through a signed URL minted for
-- someone who passes the policies below. A public bucket would make every
-- attachment readable by anyone holding the URL, which is not what "internal
-- chat" means.
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

-- Object paths are `<conversation_id>/<uuid>-<filename>`, so the first path
-- segment is the conversation and membership can be checked from it directly.
drop policy if exists chat_attachments_read on storage.objects;
create policy chat_attachments_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and public.is_conversation_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists chat_attachments_write on storage.objects;
create policy chat_attachments_write
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and owner = auth.uid()
    and public.is_conversation_member((storage.foldername(name))[1]::uuid)
  );

-- Deleting your own uploads only. No update policy: an attachment that can be
-- swapped after the fact is not evidence of what was sent.
drop policy if exists chat_attachments_delete on storage.objects;
create policy chat_attachments_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and owner = auth.uid());


-- ── Verification ─────────────────────────────────────────────────────────
--   select conname from pg_constraint
--    where conrelid = 'public.conversations'::regclass and conname like 'conversations_%';
--       -- expect conversations_kind_check and conversations_shape
--
--   select id, public, file_size_limit from storage.buckets where id = 'chat-attachments';
--       -- expect public = false, 10485760
--
--   select policyname from pg_policies
--    where tablename = 'objects' and policyname like 'chat_attachments%';   -- 3 rows
