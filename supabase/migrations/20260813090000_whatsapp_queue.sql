-- WhatsApp agent: process inbound messages in the background, not inline.
--
-- The webhook was replying to Meta only after the model loop finished —
-- five or ten seconds of waiting. Meta treats a slow webhook as a failed
-- delivery and retries, and even after the dedupe index that meant two
-- Meta round-trips per message and a customer who watched WhatsApp spin
-- before every reply. The fix is the standard shape for slow webhooks:
-- persist the work, return 200 immediately, do the work asynchronously.
--
-- Queue rows outlive the request that inserted them, so the after()
-- handoff is a safety net rather than the only path. A pending row that's
-- older than a couple of minutes is one the after() task never finished
-- (cold shutdown, unhandled crash) — a cron sweep picks those up.

create table if not exists public._whatsapp_agent_queue (
  id             uuid        primary key default gen_random_uuid(),
  wa_from        text        not null,
  wa_message_id  text,
  body           text        not null,
  -- 'pending' → not yet claimed by a worker.
  -- 'processing' → a worker holds it (claimed_at set).
  -- 'done' → replied to the customer successfully.
  -- 'failed' → attempts exhausted; kept for inspection, not retried.
  status         text        not null default 'pending'
                             check (status in ('pending','processing','done','failed')),
  attempts       int         not null default 0,
  last_error     text,
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz,
  processed_at   timestamptz
);

-- Sweep index: pending or stuck-processing rows, oldest first. Partial so
-- the done/failed backlog doesn't slow the picker down as it grows.
create index if not exists whatsapp_agent_queue_pending_idx
  on public._whatsapp_agent_queue (created_at)
  where status in ('pending','processing');

alter table public._whatsapp_agent_queue enable row level security;
-- Admin-only surface: the webhook writes with the service-role key, and
-- no browser UI reads this table today. Left with no policies on purpose;
-- add a read policy the day a debug screen wants to look at it.

-- Verify:
--   select status, count(*) from public._whatsapp_agent_queue group by status;
