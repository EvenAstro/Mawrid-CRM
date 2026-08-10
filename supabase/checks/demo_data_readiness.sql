-- Demo-data readiness check.
--
-- Run this in the Supabase SQL editor and paste the results back. Each query
-- answers one question that decides whether a planned feature will look alive
-- or look broken on stage.
--
-- Definitions here deliberately mirror lib/copilot/snapshot.ts: "stalled" is
-- 7+ days with no activity, and the clock is anchored to the dataset's latest
-- activity rather than wall-clock now, because this CRM's data is historical.
-- Anchoring to now would mark every deal stalled and every task overdue.


-- Every join below casts both sides to text. That is not laziness: this
-- schema mixes uuid and text keys (deals.id is text, profiles.id is uuid),
-- and an earlier version of this file assumed they matched and failed with
-- "operator does not exist: uuid = text". Casting to text joins correctly
-- regardless of which side is which, and a read-only check has no reason to
-- care about index usage.


-- ── -1. What are the key types actually? ─────────────────────────────────
-- Run this first. It costs nothing and it settles the question instead of
-- leaving it to be assumed again.
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'deals'      and column_name in ('id','owner_id','stage_id','lost_reason_id'))
    or (table_name = 'leads'    and column_name in ('id','owner_id'))
    or (table_name = 'profiles' and column_name in ('id','full_name','first_name','email'))
    or (table_name = 'activities' and column_name in ('id','entity_id','user_id'))
    or (table_name = 'pipeline_stages' and column_name = 'id')
  )
order by table_name, column_name;


-- ── 0. How old is the data? ──────────────────────────────────────────────
-- Decides whether "آخر نشاط" columns read as "قبل ٣ أيام" or "قبل ٧ أشهر".
select
  max(occurred_at)                                        as latest_activity,
  now()::date - max(occurred_at)::date                    as days_behind_today,
  count(*)                                                as activities_total,
  count(*) filter (where occurred_at > now() - interval '30 days') as in_last_30d
from activities;


-- ── 1. Owner spread on deals — feeds proposal 67 ─────────────────────────
-- PASS: 3+ owners, none holding more than ~60% of open deals.
-- FAIL: 1 owner, or one owner holding nearly everything. 67 shows one row.
select
  coalesce(p.full_name, p.first_name, p.email, d.owner_id::text, '— بدون مالك —') as owner,
  count(*)                                                     as deals_total,
  count(*) filter (where s.terminal_type is null)              as open_deals,
  count(*) filter (where s.terminal_type = 'won')              as won,
  count(*) filter (where s.terminal_type = 'lost')             as lost,
  round(sum(coalesce(d.won_value_minor, d.expected_value_minor, 0)) / 100.0) as value_sar
from deals d
left join pipeline_stages s on s.id::text = d.stage_id::text
left join profiles p on p.id::text = d.owner_id::text
where d.deleted_at is null
group by 1, d.owner_id
order by open_deals desc;

-- Same question in one line, for a quick pass/fail read.
select
  count(distinct owner_id) filter (where owner_id is not null) as distinct_owners,
  count(*) filter (where owner_id is null)                     as deals_with_no_owner,
  count(*)                                                     as deals_total
from deals
where deleted_at is null;


-- ── 2. Stalled deals — feeds proposals 66 and the dashboard's stuck count ─
-- PASS: 5-12 stalled open deals, spread across more than one owner.
-- FAIL: 0 (the follow-up queue is empty) or nearly all of them (looks like
--       a broken date filter, and a manager will read it that way).
with anchor as (select max(occurred_at) as data_now from activities),
last_touch as (
  select d.id,
         d.name,
         d.owner_id,
         s.label as stage,
         round(coalesce(d.won_value_minor, d.expected_value_minor, 0) / 100.0) as value_sar,
         max(a.occurred_at) as last_activity
  from deals d
  left join pipeline_stages s on s.id::text = d.stage_id::text
  left join activities a
         on a.entity_type = 'deal' and a.entity_id::text = d.id::text
  where d.deleted_at is null and s.terminal_type is null
  group by d.id, d.name, d.owner_id, s.label, d.won_value_minor, d.expected_value_minor
)
select
  count(*)                                                     as open_deals,
  count(*) filter (where lt.last_activity is null)             as never_touched,
  count(*) filter (
    where lt.last_activity < (select data_now from anchor) - interval '7 days'
  )                                                            as stalled_7d_plus,
  count(distinct lt.owner_id) filter (
    where lt.last_activity < (select data_now from anchor) - interval '7 days'
  )                                                            as stalled_across_owners
from last_touch lt;

-- The actual stalled list, so you can see whether the names look real.
with anchor as (select max(occurred_at) as data_now from activities)
select d.name,
       s.label                                              as stage,
       round(coalesce(d.expected_value_minor, 0) / 100.0)   as value_sar,
       max(a.occurred_at)                                   as last_activity,
       ((select data_now from anchor)::date - max(a.occurred_at)::date) as days_silent
from deals d
left join pipeline_stages s on s.id::text = d.stage_id::text
left join activities a on a.entity_type = 'deal' and a.entity_id::text = d.id::text
where d.deleted_at is null and s.terminal_type is null
group by d.id, d.name, s.label, d.expected_value_minor
having max(a.occurred_at) < (select data_now from anchor) - interval '7 days'
order by days_silent desc
limit 15;


-- ── 3. Lost deals with a real trail — feeds the investigation report ──────
-- The report needs: several activities, an inbound one among them, and at
-- least one turning-point tag (soft_decline, awaiting_third_party,
-- awaiting_external_event, busy_reschedule). Without a tagged inbound
-- message it has no turning point to find and the headline section is empty.
--
-- PASS: 3+ deals with turning_points >= 1 and activities >= 5.
select d.id,
       d.name,
       count(a.id)                                                  as activities,
       count(a.id) filter (where a.direction = 'inbound')            as inbound,
       count(a.id) filter (where a.situational_tag is not null)      as tagged,
       count(a.id) filter (
         where a.situational_tag in ('soft_decline','awaiting_third_party',
                                     'awaiting_external_event','busy_reschedule')
       )                                                             as turning_points
from deals d
join pipeline_stages s on s.id::text = d.stage_id::text and s.terminal_type = 'lost'
left join activities a on a.entity_type = 'deal' and a.entity_id::text = d.id::text
where d.deleted_at is null
group by d.id, d.name
order by turning_points desc, activities desc
limit 20;


-- ── 4. Tag coverage overall — feeds proposals 64 and the playbook ────────
-- The playbook needs MIN_SAMPLE = 4 per tag before it will call something a
-- pattern. Tags under 4 are shown but explicitly not claimed as confirmed.
select coalesce(situational_tag, '— غير مصنّف —') as tag,
       count(*)                                   as n
from activities
where entity_type = 'deal'
group by 1
order by n desc;
