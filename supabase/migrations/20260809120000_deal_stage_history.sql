-- deal_stage_history — append-only log of every deal stage transition.
--
-- Why this lands before anything reads it: the deals table stores only a
-- deal's *current* stage_id. Time-in-stage, deal velocity and stage-to-stage
-- conversion cannot be derived after the fact from a current-state column —
-- a transition that was never logged is gone. So the write path ships now and
-- the table accumulates history while the reading features are still being
-- built.
--
-- The key column types are read from the live schema rather than hardcoded.
-- The first version of this file assumed `deals.id` was uuid; it is text, and
-- the foreign key failed with "Key columns are of incompatible types". Since
-- this file cannot be tested against the database before you run it, it now
-- adapts instead of guessing.
--
-- This project has no migration tooling; the schema is managed by hand in the
-- Supabase SQL editor. This file is the record of what was applied. Run it
-- there, then confirm with the verification queries at the bottom.

-- ── Table ────────────────────────────────────────────────────────────────
do $mig$
declare
  deal_id_type  text;
  stage_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into deal_id_type
    from pg_attribute a
   where a.attrelid = 'public.deals'::regclass and a.attname = 'id' and a.attnum > 0;

  select format_type(a.atttypid, a.atttypmod) into stage_id_type
    from pg_attribute a
   where a.attrelid = 'public.pipeline_stages'::regclass and a.attname = 'id' and a.attnum > 0;

  if deal_id_type is null or stage_id_type is null then
    raise exception 'could not read id types (deals: %, pipeline_stages: %)',
      deal_id_type, stage_id_type;
  end if;

  execute format($ddl$
    create table if not exists public.deal_stage_history (
      id            uuid primary key default gen_random_uuid(),
      deal_id       %s not null references public.deals (id) on delete cascade,
      from_stage_id %s references public.pipeline_stages (id) on delete set null,
      to_stage_id   %s not null references public.pipeline_stages (id) on delete restrict,
      changed_by    uuid references auth.users (id) on delete set null,
      changed_at    timestamptz not null default now()
    )
  $ddl$, deal_id_type, stage_id_type, stage_id_type);

  raise notice 'deal_stage_history ready — deal_id %, stage ids %',
    deal_id_type, stage_id_type;
end
$mig$;

comment on table public.deal_stage_history is
  'Append-only log of deal stage transitions. Written on every stage move; read by velocity and funnel-conversion features. Never updated or deleted.';
comment on column public.deal_stage_history.from_stage_id is
  'Null for the first transition after creation, or where the previous stage was unknown to the client.';

-- ── Indexes ──────────────────────────────────────────────────────────────
-- The two queries this table exists to serve: a single deal's arc, and all
-- transitions in a period across the org.
create index if not exists deal_stage_history_deal_idx
  on public.deal_stage_history (deal_id, changed_at);
create index if not exists deal_stage_history_changed_at_idx
  on public.deal_stage_history (changed_at desc);

-- ── Row level security ───────────────────────────────────────────────────
alter table public.deal_stage_history enable row level security;

-- Read access mirrors the deal itself: if RLS lets you see the deal, you can
-- see its history. Rather than duplicate the deals policy here, defer to it.
drop policy if exists deal_stage_history_select on public.deal_stage_history;
create policy deal_stage_history_select
  on public.deal_stage_history
  for select
  to authenticated
  using (
    exists (
      select 1 from public.deals d
      where d.id = deal_stage_history.deal_id
    )
  );

-- Insert-only for authenticated users, and only as themselves. There is
-- deliberately no update or delete policy: this is an append-only log, and
-- a log that can be rewritten is not evidence.
drop policy if exists deal_stage_history_insert on public.deal_stage_history;
create policy deal_stage_history_insert
  on public.deal_stage_history
  for insert
  to authenticated
  with check (changed_by = auth.uid());

-- ── Verification ─────────────────────────────────────────────────────────
-- Expect: two policies, two indexes, and the column types matching deals.id
-- and pipeline_stages.id.
--
--   select policyname from pg_policies where tablename = 'deal_stage_history';
--   select indexname  from pg_indexes  where tablename = 'deal_stage_history';
--   select column_name, data_type from information_schema.columns
--    where table_name = 'deal_stage_history' order by ordinal_position;
