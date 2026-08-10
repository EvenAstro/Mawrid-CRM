-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  DEMO SEED DATA ONLY — NEVER RUN THIS AGAINST REAL CUSTOMER DATA.    ║
-- ║  It rewrites activity timestamps. On a live account that is          ║
-- ║  falsifying the record of when people were contacted.                ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Deliberately NOT in supabase/migrations/ — this must never be applied
-- automatically as part of a deploy.
--
--
-- WHAT IS WRONG
--
-- The seed generated two activity streams that end 15 days apart:
--
--   deal-linked activity  → ends 2026-07-21
--   lead-linked activity  → ends 2026-08-05
--
-- Time windows are anchored to the newest activity overall (snapshot.ts), so
-- the anchor comes from the lead stream and the stalled threshold lands at
-- 2026-07-29 — later than EVERY deal-linked activity in the database. The
-- result: 33 of 39 open deals classified as stalled, plus 6 with no activity
-- at all. Every open deal. That is not a signal, it is a division by an
-- anchor belonging to a different stream.
--
-- It also splits the product against itself: لوحة الفريق anchors on the newest
-- deal activity (2026-07-21) while the dashboard anchors on the newest overall
-- (2026-08-05), so the two screens report different stalled counts for the
-- same board.
--
--
-- WHY A STAGGERED SHIFT AND NOT A FLAT ONE
--
-- A flat +15 days would align the two streams but preserve the clustering.
-- The measured distribution of last-touch across the 33 open deals that have
-- any activity:
--
--   0-7 days before the deal stream's end     3
--   8-14 days                                 0
--   15-30 days                               26
--   over 30 days                              4
--
-- Shifting everything equally leaves 30 of 39 stalled. The spacing itself is
-- the problem — the generator wrote deal activity in one burst.
--
-- So each deal gets its own shift, chosen to land its most recent activity a
-- specific number of days before the anchor. Every activity on that deal moves
-- by the same amount, so each deal's internal history — the order and spacing
-- of its own touchpoints — is preserved exactly. Only the deal's position
-- relative to today changes.
--
-- Target mix across the 33 deals that have activity:
--
--   22 deals    0-6 days silent    healthy, recently worked
--    5 deals    7-14 days          stalled — the mild case
--    6 deals    15-35 days         stalled — the case worth demoing
--
-- Plus the 6 deals with no activity at all, left untouched. A real board does
-- have deals nobody has logged anything against, and لوحة الفريق counts them
-- as silent on purpose.
--
-- That gives 11 silent by time + 6 never touched = 17 of 39. A board where
-- roughly half the pipeline needs attention reads as a team with a real
-- problem, which is the honest story. A board where everything is stalled
-- reads as a broken filter.
--
--
-- WHY OPEN DEALS ONLY
--
-- Lost deals are excluded. The investigation report computes "how many days
-- before the loss" from the gap between an activity and the deal's close date.
-- Moving activities without moving the deal pushes the turning point past the
-- close and destroys the 18 lost deals that have a usable trail — the closing
-- moment of the demo. Open deals have no close date to break against.
--
-- Won deals are excluded for the same reason.


-- ── Reversal log ─────────────────────────────────────────────────────────
-- Records exactly what was applied to each deal, so this is undoable and so a
-- second run cannot double-shift.
create table if not exists public._seed_shift_log (
  deal_id    text primary key,
  shift_days integer not null,
  applied_at timestamptz not null default now()
);


-- ── The shift ────────────────────────────────────────────────────────────
with anchor as (
  -- The lead stream's end is the date the whole dataset should appear to end.
  select max(occurred_at)::date as anchor_date
  from activities
  where entity_type = 'lead'
),
open_deals as (
  select d.id, max(a.occurred_at)::date as last_act
  from deals d
  join pipeline_stages s on s.id::text = d.stage_id::text
  left join activities a
         on a.entity_type = 'deal' and a.entity_id::text = d.id::text
  where d.deleted_at is null
    and s.terminal_type is null
    and not exists (select 1 from public._seed_shift_log l where l.deal_id = d.id::text)
  group by d.id
  having max(a.occurred_at) is not null
),
ranked as (
  -- md5(id) rather than id, so the assignment doesn't correlate with insertion
  -- order — otherwise every "healthy" deal would be the oldest or newest batch.
  select id, last_act, row_number() over (order by md5(id::text)) as rn
  from open_deals
),
targets as (
  select id, last_act,
         case
           when rn <= 22 then (rn % 7)              -- 0-6  days silent
           when rn <= 27 then 7 + (rn % 8)          -- 7-14 days
           else               15 + (rn % 21)        -- 15-35 days
         end as target_days
  from ranked
),
shifts as (
  select t.id,
         ((a.anchor_date - t.target_days) - t.last_act) as shift_days
  from targets t, anchor a
),
-- Logging and applying are one statement. A separate UPDATE would have to
-- identify "this run's rows" by timestamp, which is wrong the moment the two
-- statements are run a minute apart or replayed — and double-shifting is
-- silent, because a shifted date looks exactly like a correct one.
logged as (
  insert into public._seed_shift_log (deal_id, shift_days)
  select id::text, shift_days from shifts
  on conflict (deal_id) do nothing
  returning deal_id, shift_days
)
update activities a
   set occurred_at = a.occurred_at + (l.shift_days || ' days')::interval
  from logged l
 where a.entity_type = 'deal'
   and a.entity_id = l.deal_id;


-- ── Verification — run after, expect a spread rather than a wall ─────────
--
--   with anchor as (select max(occurred_at) as data_now from activities),
--   last_touch as (
--     select d.id, max(a.occurred_at) as last_act
--     from deals d
--     join pipeline_stages s on s.id::text = d.stage_id::text
--     left join activities a on a.entity_type='deal' and a.entity_id::text = d.id::text
--     where d.deleted_at is null and s.terminal_type is null
--     group by d.id
--   )
--   select
--     count(*)                                                          as open_deals,
--     count(*) filter (where last_act is null)                          as never_touched,
--     count(*) filter (where last_act >= (select data_now from anchor) - interval '7 days')  as healthy,
--     count(*) filter (where last_act <  (select data_now from anchor) - interval '7 days')  as stalled
--   from last_touch;
--
--   -- expect roughly: open_deals 39 · never_touched 6 · healthy 22 · stalled 11
--
-- Both streams should now end on the same date:
--   select entity_type, max(occurred_at)::date from activities group by 1;
--
--
-- ── Undo ─────────────────────────────────────────────────────────────────
--   update activities a
--      set occurred_at = a.occurred_at - (l.shift_days || ' days')::interval
--     from public._seed_shift_log l
--    where a.entity_type = 'deal' and a.entity_id::text = l.deal_id;
--   delete from public._seed_shift_log;
