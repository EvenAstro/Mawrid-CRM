-- WhatsApp test agent — sandbox only, never wired to a real customer number.
--
-- Two things: a kill switch that can be flipped without a redeploy, and a
-- log of every inbound/outbound message the agent sends, so the whole
-- exchange is reviewable after the fact — the same discipline every AI
-- surface in this product follows, applied here because "the agent replies
-- to anything" is exactly the surface that most needs to be checkable.

create table if not exists public._whatsapp_agent_settings (
  id         boolean primary key default true,   -- singleton row
  enabled    boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint singleton check (id)
);
insert into public._whatsapp_agent_settings (id, enabled)
values (true, false)
on conflict (id) do nothing;

-- Every message the sandbox number has seen or sent, independent of the
-- activities table — this is test traffic on a test number, not a customer
-- record, and keeping it separate means it can be wiped without touching
-- anything a rep relies on.
create table if not exists public._whatsapp_agent_log (
  id           uuid primary key default gen_random_uuid(),
  wa_from      text not null,          -- the test recipient's WhatsApp number
  direction    text not null check (direction in ('inbound', 'outbound')),
  body         text not null,
  wa_message_id text,
  created_at   timestamptz not null default now()
);
create index if not exists whatsapp_agent_log_wa_from_idx
  on public._whatsapp_agent_log (wa_from, created_at);

alter table public._whatsapp_agent_settings enable row level security;
alter table public._whatsapp_agent_log enable row level security;

-- Read for any authenticated user (it's a settings panel), write only via
-- the service-role key the webhook route uses.
drop policy if exists whatsapp_agent_settings_read on public._whatsapp_agent_settings;
create policy whatsapp_agent_settings_read
  on public._whatsapp_agent_settings for select to authenticated using (true);

drop policy if exists whatsapp_agent_log_read on public._whatsapp_agent_log;
create policy whatsapp_agent_log_read
  on public._whatsapp_agent_log for select to authenticated using (true);

-- Verification:
--   select * from public._whatsapp_agent_settings;   -- expect one row, enabled=false
--   select count(*) from public._whatsapp_agent_log;  -- expect 0
