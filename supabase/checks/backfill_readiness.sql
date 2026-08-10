-- Backfill readiness — run before `npm run tag:backfill`.
--
-- Answers two questions:
--   1. How many rows actually match the script's filter?
--   2. Can the key the script uses even see and write them?
--
-- One statement, one result grid — the SQL editor only shows the last result.
--
-- Note on question 2: this editor runs as a privileged role, so it CANNOT
-- directly test what the anon key sees. What it can do is report whether RLS
-- is enabled on activities and what the policies say, which settles the
-- question by reading rather than guessing. The definitive test is the curl
-- in the comment block at the bottom — that one actually uses the anon key.

select 0 as ord, 'candidates' as check,
       'matches_script_filter' as metric,
       count(*)::text as value
from activities
where direction = 'inbound'
  and body is not null
  and body <> ''
  and situational_tag is null

union all select 1, 'candidates', 'already_tagged',
  (select count(*)::text from activities where situational_tag is not null)

union all select 2, 'candidates', 'inbound_total',
  (select count(*)::text from activities where direction = 'inbound')

union all select 3, 'candidates', 'inbound_with_empty_body',
  (select count(*)::text from activities
    where direction = 'inbound' and (body is null or body = ''))

-- Cost check: the classifier prompt is short, so tokens track row count.
union all select 4, 'candidates', 'est_cost_usd_at_0.0008_per_row',
  (select round(count(*) * 0.0008, 2)::text from activities
    where direction = 'inbound' and body is not null and body <> ''
      and situational_tag is null)

-- Runtime check: the script sleeps 2.1s between rows, serially.
union all select 5, 'candidates', 'est_runtime_minutes_at_2.1s_per_row',
  (select round(count(*) * 2.1 / 60.0, 1)::text from activities
    where direction = 'inbound' and body is not null and body <> ''
      and situational_tag is null)

-- ── Question 2: does the anon key get past RLS? ──────────────────────────
union all select 10, 'rls', 'row_level_security_enabled',
  (select relrowsecurity::text from pg_class where oid = 'public.activities'::regclass)

union all select 11, 'rls', 'policy: ' || policyname,
  cmd || ' → to=' || array_to_string(roles, ',') ||
  ' | using=' || coalesce(qual, '—') ||
  ' | check=' || coalesce(with_check, '—')
from pg_policies
where schemaname = 'public' and tablename = 'activities'

order by ord, metric;


-- ── The definitive anon-key test ─────────────────────────────────────────
-- Run this in a terminal, NOT here. It uses the same key and the same
-- (absent) session as the script, so whatever it returns is exactly what the
-- script will see. Prefer=count means no rows are transferred.
--
--   curl -s -I \
--     'https://ctibusjfvbffdlmzkqxh.supabase.co/rest/v1/activities?select=id&direction=eq.inbound&situational_tag=is.null&body=not.is.null' \
--     -H 'apikey: <SUPABASE_ANON_KEY from lib/supabase.ts>' \
--     -H 'Prefer: count=exact' \
--     -H 'Range: 0-0'
--
-- Read the content-range header:
--   content-range: 0-0/487   → the anon key sees 487 rows. Script works.
--   content-range: */0       → RLS blocks it. Script is a silent no-op.
--
-- A SELECT passing does not mean the UPDATE will. If the count is non-zero,
-- the 50-row trial run is still the real test, because it exercises the write.
