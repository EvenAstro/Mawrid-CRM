-- Fire rate per health factor, across the open-deal population.
--
-- Reproduces each factor's condition exactly as lib/dealHealth/computeHealth.ts
-- evaluates it, so the percentages here are what suppressNonDiscriminating
-- will act on. Anything above 70% is pulled from the score and rendered as
-- "فحصناه ولا يفرّق".
--
-- Anchored to the newest DEAL activity, matching AtRiskSection.
-- Read-only.

with anchor as (
  select max(occurred_at) as data_now from activities where entity_type = 'deal'
),
open_deals as (
  select d.id, d.created_at
  from deals d
  join pipeline_stages s on s.id::text = d.stage_id::text
  where d.deleted_at is null and s.terminal_type is null
),
acts as (
  select a.entity_id, a.occurred_at, a.direction, a.situational_tag
  from activities a
  join open_deals o on o.id = a.entity_id
  where a.entity_type = 'deal'
),
per_deal as (
  select o.id,
         o.created_at,
         max(a.occurred_at)                                      as last_act,
         count(*) filter (where a.direction = 'inbound')          as inbound,
         count(*) filter (where a.direction = 'outbound')         as outbound
  from open_deals o
  left join acts a on a.entity_id = o.id
  group by o.id, o.created_at
),
latest_inbound as (
  select distinct on (entity_id) entity_id, situational_tag
  from acts
  where direction = 'inbound'
  order by entity_id, occurred_at desc
),
won_ages as (
  select extract(epoch from (d.updated_at - d.created_at)) / 86400.0 as age
  from deals d
  join pipeline_stages s on s.id::text = d.stage_id::text and s.terminal_type = 'won'
  where d.deleted_at is null and d.created_at is not null and d.updated_at is not null
),
-- 75th percentile, matching the change just shipped. Falls back to 60 days
-- when there are fewer than 4 won deals, same as the code.
age_basis as (
  select case when (select count(*) from won_ages) >= 4
              then greatest(1, percentile_disc(0.75) within group (order by age))
              else 60 end as p75
  from won_ages
),
pop as (select count(*)::numeric as n from per_deal),
fires as (
  select
    count(*) filter (
      where li.situational_tag in ('soft_decline','awaiting_third_party',
                                   'awaiting_external_event','busy_reschedule')
    )                                                              as turning_point,
    -- silence: no activity at all, or silent longer than the fallback 7 days
    -- (the silence baseline does not derive on this account — sample 2 of 4)
    count(*) filter (
      where p.last_act is null
         or p.last_act < (select data_now from anchor) - interval '7 days'
    )                                                              as silence,
    count(*) filter (
      where (p.outbound >= 3 and p.inbound = 0)
         or (p.outbound >= 4 and p.inbound > 0 and p.outbound::numeric / p.inbound >= 4)
    )                                                              as one_sided,
    count(*) filter (
      where p.created_at is not null
        and extract(epoch from ((select data_now from anchor) - p.created_at)) / 86400.0
            > (select p75 from age_basis)
    )                                                              as age
  from per_deal p
  left join latest_inbound li on li.entity_id = p.id
)

select 'age_baseline_p75_days' as factor,
       (select round(p75)::text from age_basis) as fired,
       '' as population, '' as pct, '' as verdict
union all
select 'turning_point', f.turning_point::text, p.n::text,
       round(100 * f.turning_point / p.n, 1)::text,
       case when f.turning_point / p.n > 0.7 then 'SUPPRESSED' else 'ok' end
from fires f, pop p
union all
select 'silence', f.silence::text, p.n::text,
       round(100 * f.silence / p.n, 1)::text,
       case when f.silence / p.n > 0.7 then 'SUPPRESSED' else 'ok' end
from fires f, pop p
union all
select 'one_sided', f.one_sided::text, p.n::text,
       round(100 * f.one_sided / p.n, 1)::text,
       case when f.one_sided / p.n > 0.7 then 'SUPPRESSED' else 'ok' end
from fires f, pop p
union all
select 'age', f.age::text, p.n::text,
       round(100 * f.age / p.n, 1)::text,
       case when f.age / p.n > 0.7 then 'SUPPRESSED' else 'ok' end
from fires f, pop p
union all
-- no_next_step is suppressed upstream: nothing in the product creates a
-- deal-linked task, so the dimension is absent rather than uniform.
select 'no_next_step_deal_linked_open_tasks',
       (select count(*)::text from tasks
         where entity_type = 'deal' and completed_at is null),
       '', '', 'unmeasured if 0';
