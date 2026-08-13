-- Lead assignment rules — how a fresh lead (from WhatsApp or anywhere) gets
-- routed to the right rep automatically.
--
-- Two failure modes to avoid, both real. Every lead landing on one person's
-- inbox until they get around to reassigning it is invisible work and
-- unfair — the round-robin pool solves that. And every lead getting the
-- same generic rep loses the "the restaurants person answers restaurant
-- calls" advantage — the rules solve that. So this table carries both, and
-- resolve_lead_assignment() tries the rules in priority order first, then
-- falls back to a round-robin pool if none of them fired.
--
-- Conditions live in a jsonb column rather than columns per condition so a
-- new dimension (region, deal size) can be added later without a schema
-- change. The evaluator function reads the ones it knows about and ignores
-- the rest.

create table if not exists public.lead_assignment_rules (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  priority     int         not null default 100,
  enabled      boolean     not null default true,
  -- Recognised shape:
  --   { "industry": "مطاعم", "min_size": 5, "max_size": 50, "source": "واتساب" }
  -- All fields optional; every present one has to match.
  conditions   jsonb       not null default '{}'::jsonb,
  -- 'assign_user' → assignee_id must be set; every match goes to that user.
  -- 'round_robin_pool' → pool_ids must be non-empty; picks the next member.
  -- 'unassigned' → deliberately leaves owner_id null (self-serve leads).
  action_type  text        not null
                            check (action_type in ('assign_user','round_robin_pool','unassigned')),
  assignee_id  uuid,
  pool_ids     uuid[],
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists lead_assignment_rules_priority_idx
  on public.lead_assignment_rules (priority)
  where enabled = true;

-- Ledger of who was picked, per pool, per lead — read by the round-robin
-- picker to keep distribution even, and by anyone auditing why a lead
-- landed where it did.
create table if not exists public._lead_assignment_history (
  id           uuid        primary key default gen_random_uuid(),
  lead_id      text        not null,
  rule_id      uuid,       -- null when the fallback (unrouted round-robin) fired
  assignee_id  uuid,       -- null on 'unassigned'
  pool_key     text,       -- serialised pool_ids, so the picker can group per pool
  created_at   timestamptz not null default now()
);
create index if not exists lead_assignment_history_pool_idx
  on public._lead_assignment_history (pool_key, created_at desc)
  where pool_key is not null;

-- Sales-role users who count as available for the default fallback pool
-- (nothing matched, but a lead has to land somewhere). Manager/admin are
-- excluded so leads don't route to people who don't work them; the rules
-- above can still name them explicitly if that's ever wanted.
create or replace function public.default_sales_pool()
returns uuid[]
language sql
stable
as $$
  select coalesce(array_agg(id order by id), array[]::uuid[])
  from public.profiles
  where role = 'sales';
$$;

/**
 * Picks the next assignee from a pool by finding whoever hasn't been
 * picked from this exact pool for the longest — a real least-recently-
 * used, not a naive counter that a manually-reassigned lead would
 * corrupt. Ties (someone never picked) win the pick.
 */
create or replace function public.pick_round_robin(pool uuid[])
returns uuid
language plpgsql
stable
as $$
declare
  pool_hash text;
  picked    uuid;
begin
  if pool is null or array_length(pool, 1) is null then
    return null;
  end if;
  -- The pool key is the sorted pool serialised — same members in a
  -- different order share the same rotation.
  select string_agg(x::text, ',' order by x) into pool_hash
  from unnest(pool) as x;

  with last_pick as (
    select assignee_id, max(created_at) as last_at
    from public._lead_assignment_history
    where pool_key = pool_hash
    group by assignee_id
  )
  select member
  into picked
  from unnest(pool) as member
  left join last_pick lp on lp.assignee_id = member
  order by lp.last_at nulls first, member
  limit 1;

  return picked;
end;
$$;

/**
 * Resolves who a lead should go to. Called from the WhatsApp agent's
 * assign_lead tool and from any other code path that creates a lead
 * without a specific owner in mind.
 *
 * Rules run in priority order (low number first). The first rule whose
 * conditions all match wins; missing conditions are wildcards. If nothing
 * matches, falls back to a round-robin over the default sales pool so the
 * lead lands somewhere rather than sitting owner-less.
 *
 * Every decision is recorded in _lead_assignment_history: for auditing,
 * for the round-robin picker itself, and for a future "why did this lead
 * land on me" tooltip.
 */
create or replace function public.resolve_lead_assignment(
  p_lead_id     text,
  p_industry    text default null,
  p_size        int  default null,
  p_source      text default null
)
returns table (
  assignee_id uuid,
  rule_id     uuid,
  rule_name   text
)
language plpgsql
as $$
declare
  r          record;
  picked_uid uuid;
  pool_hash  text;
  effective_pool uuid[];
begin
  for r in
    select id, name, priority, action_type, assignee_id, pool_ids, conditions
    from public.lead_assignment_rules
    where enabled = true
    order by priority, created_at
  loop
    -- Every condition present on the rule must match. A condition the rule
    -- doesn't set is a wildcard.
    if r.conditions ? 'industry'
       and lower(coalesce(p_industry,'')) not like '%' || lower(r.conditions->>'industry') || '%'
    then continue;
    end if;
    if r.conditions ? 'source'
       and lower(coalesce(p_source,'')) <> lower(r.conditions->>'source')
    then continue;
    end if;
    if r.conditions ? 'min_size'
       and (p_size is null or p_size < (r.conditions->>'min_size')::int)
    then continue;
    end if;
    if r.conditions ? 'max_size'
       and (p_size is null or p_size > (r.conditions->>'max_size')::int)
    then continue;
    end if;

    -- Matched. Take the rule's action.
    if r.action_type = 'assign_user' then
      picked_uid := r.assignee_id;
    elsif r.action_type = 'round_robin_pool' then
      picked_uid := public.pick_round_robin(r.pool_ids);
    else
      picked_uid := null; -- 'unassigned'
    end if;

    if r.action_type = 'round_robin_pool' then
      select string_agg(x::text, ',' order by x) into pool_hash
      from unnest(r.pool_ids) as x;
    else
      pool_hash := null;
    end if;

    insert into public._lead_assignment_history (lead_id, rule_id, assignee_id, pool_key)
    values (p_lead_id, r.id, picked_uid, pool_hash);

    return query select picked_uid, r.id, r.name;
    return;
  end loop;

  -- Fallback: no rule matched. Round-robin the default sales pool so the
  -- lead lands somewhere. A team with no sales-role users at all gets a
  -- genuinely unassigned lead — that's a config problem, not a routing
  -- problem to solve here.
  effective_pool := public.default_sales_pool();
  picked_uid := public.pick_round_robin(effective_pool);
  select string_agg(x::text, ',' order by x) into pool_hash
  from unnest(effective_pool) as x;
  insert into public._lead_assignment_history (lead_id, rule_id, assignee_id, pool_key)
  values (p_lead_id, null, picked_uid, pool_hash);

  return query select picked_uid, null::uuid, 'التوزيع الدوري الافتراضي'::text;
end;
$$;

alter table public.lead_assignment_rules enable row level security;
alter table public._lead_assignment_history enable row level security;

drop policy if exists lead_assignment_rules_read on public.lead_assignment_rules;
create policy lead_assignment_rules_read
  on public.lead_assignment_rules for select to authenticated using (true);

drop policy if exists lead_assignment_rules_write on public.lead_assignment_rules;
create policy lead_assignment_rules_write
  on public.lead_assignment_rules for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager'))
  );

drop policy if exists lead_assignment_history_read on public._lead_assignment_history;
create policy lead_assignment_history_read
  on public._lead_assignment_history for select to authenticated using (true);

grant execute on function public.resolve_lead_assignment(text, text, int, text) to authenticated, service_role;
grant execute on function public.pick_round_robin(uuid[]) to authenticated, service_role;
grant execute on function public.default_sales_pool() to authenticated, service_role;

-- Verify:
--   select * from public.resolve_lead_assignment('demo-lead', 'مطعم', 25, 'واتساب');
