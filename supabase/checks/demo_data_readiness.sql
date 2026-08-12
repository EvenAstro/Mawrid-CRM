-- Demo-data readiness check — ONE statement, one result grid.
--
-- The previous version was six separate statements. The Supabase SQL editor
-- shows only the last result, so five of them ran and vanished. Everything
-- below is a single UNION ALL returning (ord, check, metric, value) with every
-- value cast to text, so one run produces one pasteable table.
--
-- Definitions mirror lib/copilot/snapshot.ts: "stalled" is 7+ days with no
-- activity, anchored to the dataset's latest activity rather than wall-clock
-- now, because this CRM's data is historical.
--
-- Every join casts both sides to text. This schema mixes uuid and text keys
-- (profiles.id is uuid, deals.owner_id is not), and assuming otherwise is what
-- broke the first version with "operator does not exist: uuid = text".

with anchor as (
  select max(occurred_at) as data_now from activities
),
open_deals as (
  select d.id, d.owner_id, max(a.occurred_at) as last_activity
  from deals d
  join pipeline_stages s on s.id::text = d.stage_id::text
  left join activities a
         on a.entity_type = 'deal' and a.entity_id::text = d.id::text
  where d.deleted_at is null and s.terminal_type is null
  group by d.id, d.owner_id
),
lost_trail as (
  select d.id,
         count(a.id) as acts,
         count(a.id) filter (where a.direction = 'inbound') as inbound,
         count(a.id) filter (
           where a.situational_tag in ('soft_decline','awaiting_third_party',
                                       'awaiting_external_event','busy_reschedule')
         ) as turning_points
  from deals d
  join pipeline_stages s on s.id::text = d.stage_id::text and s.terminal_type = 'lost'
  left join activities a
         on a.entity_type = 'deal' and a.entity_id::text = d.id::text
  where d.deleted_at is null
  group by d.id
),
owner_deals as (
  select d.owner_id, count(*) as n
  from deals d
  join pipeline_stages s on s.id::text = d.stage_id::text
  where d.deleted_at is null and s.terminal_type is null
  group by d.owner_id
)

select 0 as ord, 'types' as check, table_name || '.' || column_name as metric, data_type as value
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'deals'      and column_name in ('id','owner_id','stage_id'))
    or (table_name = 'leads'      and column_name in ('id','owner_id'))
    or (table_name = 'profiles'   and column_name = 'id')
    or (table_name = 'activities' and column_name in ('entity_id','user_id')))

-- 0 · how old is the data (decides whether the seed shift comes first)
union all select 10, 'recency', 'latest_activity',
  (select max(occurred_at)::text from activities)
union all select 11, 'recency', 'days_behind_today',
  (select (now()::date - max(occurred_at)::date)::text from activities)
union all select 12, 'recency', 'activities_total',
  (select count(*)::text from activities)

-- 1 · owner spread (proposal 67)
union all select 20, 'owners', 'distinct_owners_with_open_deals',
  (select count(*)::text from owner_deals where owner_id is not null)
union all select 21, 'owners', 'open_deals_with_no_owner',
  (select coalesce(sum(n),0)::text from owner_deals where owner_id is null)
union all select 22, 'owners', 'largest_owner_share_pct',
  (select coalesce(round(100.0 * max(n) / nullif(sum(n),0))::text,'0') from owner_deals)

-- 2 · stalled deals (follow-up queue, dashboard stuck count)
union all select 30, 'stalled', 'open_deals',
  (select count(*)::text from open_deals)
union all select 31, 'stalled', 'never_touched',
  (select count(*)::text from open_deals where last_activity is null)
union all select 32, 'stalled', 'stalled_7d_plus',
  (select count(*)::text from open_deals, anchor
    where last_activity < data_now - interval '7 days')
union all select 33, 'stalled', 'stalled_across_owners',
  (select count(distinct owner_id)::text from open_deals, anchor
    where last_activity < data_now - interval '7 days')

-- 3 · lost deals with a usable trail (the investigation report)
union all select 40, 'investigation', 'lost_deals_total',
  (select count(*)::text from lost_trail)
union all select 41, 'investigation', 'lost_with_5plus_activities',
  (select count(*)::text from lost_trail where acts >= 5)
union all select 42, 'investigation', 'lost_with_inbound_and_turning_point',
  (select count(*)::text from lost_trail where inbound >= 1 and turning_points >= 1)

order by ord, metric;


-- ── Run these separately, only if a number above fails ───────────────────
-- Per-owner breakdown:
--   select coalesce(p.full_name, p.first_name, p.email, d.owner_id::text, '— بدون مالك —') as owner,
--          count(*) filter (where s.terminal_type is null) as open_deals,
--          count(*) filter (where s.terminal_type = 'won')  as won,
--          count(*) filter (where s.terminal_type = 'lost') as lost
--   from deals d
--   left join pipeline_stages s on s.id::text = d.stage_id::text
--   left join profiles p on p.id::text = d.owner_id::text
--   where d.deleted_at is null group by 1 order by open_deals desc;
--
-- The stalled list itself, to check the names look real:
--   with anchor as (select max(occurred_at) as data_now from activities)
--   select d.name, s.label as stage, max(a.occurred_at) as last_activity
--   from deals d
--   left join pipeline_stages s on s.id::text = d.stage_id::text
--   left join activities a on a.entity_type='deal' and a.entity_id::text = d.id::text
--   where d.deleted_at is null and s.terminal_type is null
--   group by d.id, d.name, s.label
--   having max(a.occurred_at) < (select data_now from anchor) - interval '7 days'
--   order by max(a.occurred_at) limit 15;
--
-- Which lost deals are worth demoing:
--   select d.name, count(a.id) as acts,
--          count(a.id) filter (where a.situational_tag in
--            ('soft_decline','awaiting_third_party','awaiting_external_event','busy_reschedule')) as turning_points
--   from deals d
--   join pipeline_stages s on s.id::text = d.stage_id::text and s.terminal_type='lost'
--   left join activities a on a.entity_type='deal' and a.entity_id::text = d.id::text
--   where d.deleted_at is null group by d.id, d.name
--   order by turning_points desc, acts desc limit 10;
