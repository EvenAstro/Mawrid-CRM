-- WhatsApp agent: stop duplicate replies, and tie each conversation to the CRM.
--
-- Two problems this fixes.
--
-- 1. Duplicate replies. The webhook runs the whole model loop inline before
--    it answers Meta, which can take several seconds. Meta treats a slow
--    webhook as a failed delivery and redelivers the same message — and with
--    nothing keyed on wa_message_id, the redelivery was processed as if it
--    were new. The customer got two replies, the second one different from
--    the first because the log (and so the agent's context) had changed in
--    between. A unique index turns the inbound log insert into an atomic
--    claim: the first delivery wins, the retry conflicts and is skipped.
--
-- 2. No CRM link. The log knew a phone number and nothing else, so a rep
--    reading it couldn't tell which lead was on the other end. lead_id
--    records who the agent resolved the number to at the time it replied.

create unique index if not exists whatsapp_agent_log_wa_message_id_key
  on public._whatsapp_agent_log (wa_message_id)
  where wa_message_id is not null;

alter table public._whatsapp_agent_log
  add column if not exists lead_id uuid;

create index if not exists whatsapp_agent_log_lead_idx
  on public._whatsapp_agent_log (lead_id)
  where lead_id is not null;

-- One row per number the agent has talked to, newest conversation first.
--
-- Deliberately NOT security definer: the join to leads runs as the calling
-- user, so a rep who can't see a lead gets the conversation row with null
-- lead details rather than a name they shouldn't have. The log itself is
-- already readable by any authenticated user under its own RLS policy.
create or replace function public.whatsapp_conversations()
returns table (
  wa_from       text,
  message_count bigint,
  inbound_count bigint,
  first_at      timestamptz,
  last_at       timestamptz,
  last_body     text,
  last_direction text,
  lead_id       uuid,
  lead_name     text,
  stage_label   text,
  owner_name    text
)
language sql
stable
as $$
  with convo as (
    select
      l.wa_from,
      count(*)                                             as message_count,
      count(*) filter (where l.direction = 'inbound')       as inbound_count,
      min(l.created_at)                                     as first_at,
      max(l.created_at)                                     as last_at
    from public._whatsapp_agent_log l
    group by l.wa_from
  ),
  last_msg as (
    select distinct on (l.wa_from) l.wa_from, l.body, l.direction
    from public._whatsapp_agent_log l
    order by l.wa_from, l.created_at desc
  ),
  -- Most recent non-null link, not the link on the last row: outbound rows
  -- and pre-migration rows carry no lead_id, and a conversation that ever
  -- resolved to a lead should keep showing it.
  lead_link as (
    select distinct on (l.wa_from) l.wa_from, l.lead_id
    from public._whatsapp_agent_log l
    where l.lead_id is not null
    order by l.wa_from, l.created_at desc
  )
  select
    c.wa_from,
    c.message_count,
    c.inbound_count,
    c.first_at,
    c.last_at,
    m.body,
    m.direction,
    ld.id,
    ld.full_name,
    ps.label,
    coalesce(pr.full_name, nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''))
  from convo c
  join      last_msg  m  on m.wa_from  = c.wa_from
  left join lead_link ll on ll.wa_from = c.wa_from
  left join public.leads ld on ld.id = ll.lead_id and ld.deleted_at is null
  left join public.pipeline_stages ps on ps.id = ld.stage_id
  left join public.profiles pr on pr.id = ld.owner_id
  order by c.last_at desc;
$$;

grant execute on function public.whatsapp_conversations() to authenticated;

-- Verify:
--   select * from public.whatsapp_conversations();
--   -- one row per number, newest first; lead columns null for unmatched numbers
