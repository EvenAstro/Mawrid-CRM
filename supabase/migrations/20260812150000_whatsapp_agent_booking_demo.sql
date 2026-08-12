-- WhatsApp sandbox agent — booking demo domain.
--
-- Gives the sandbox agent (see 20260812090000) something real to reason and
-- act on: a tiny doctors/slots/bookings domain it can query and write to via
-- tool calls, so it can hold a multi-step conversation ("هل الدكتور فلان
-- متوفر اليوم؟" → "لا، بس فلان متوفر الساعة كذا، تحب أحجزلك؟") instead of
-- just talking. Same sandbox discipline as the rest of this feature: prefixed
-- tables, never touching the real contacts/deals data, wipeable without
-- consequence.

create table if not exists public._whatsapp_agent_doctors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  specialty  text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public._whatsapp_agent_slots (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public._whatsapp_agent_doctors(id) on delete cascade,
  slot_time  timestamptz not null,
  is_booked  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_agent_slots_doctor_idx
  on public._whatsapp_agent_slots (doctor_id, slot_time);

-- One booking per slot — the same UNIQUE that keeps a real scheduler honest.
create table if not exists public._whatsapp_agent_bookings (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null unique references public._whatsapp_agent_slots(id) on delete cascade,
  wa_from       text not null,   -- who booked it, over WhatsApp
  patient_name  text not null,
  created_at    timestamptz not null default now()
);
create index if not exists whatsapp_agent_bookings_wa_from_idx
  on public._whatsapp_agent_bookings (wa_from, created_at);

alter table public._whatsapp_agent_doctors enable row level security;
alter table public._whatsapp_agent_slots enable row level security;
alter table public._whatsapp_agent_bookings enable row level security;

-- Read for any authenticated user (so a future admin screen can show the
-- demo data); all writes go through the service-role key the webhook/tool
-- executor uses, same split as the rest of the sandbox.
drop policy if exists whatsapp_agent_doctors_read on public._whatsapp_agent_doctors;
create policy whatsapp_agent_doctors_read
  on public._whatsapp_agent_doctors for select to authenticated using (true);

drop policy if exists whatsapp_agent_slots_read on public._whatsapp_agent_slots;
create policy whatsapp_agent_slots_read
  on public._whatsapp_agent_slots for select to authenticated using (true);

drop policy if exists whatsapp_agent_bookings_read on public._whatsapp_agent_bookings;
create policy whatsapp_agent_bookings_read
  on public._whatsapp_agent_bookings for select to authenticated using (true);

-- Seed data: three doctors, one fully booked today so the "he's full, try
-- this other one" branch is actually reachable in a test conversation.
do $$
declare
  d_ahmad uuid;
  d_sara  uuid;
  d_faisal uuid;
  today date := current_date;
begin
  insert into public._whatsapp_agent_doctors (name, specialty, active)
  values ('د. أحمد الحربي', 'أسنان', true)
  returning id into d_ahmad;

  insert into public._whatsapp_agent_doctors (name, specialty, active)
  values ('د. سارة القحطاني', 'أسنان', true)
  returning id into d_sara;

  insert into public._whatsapp_agent_doctors (name, specialty, active)
  values ('د. فيصل العتيبي', 'جلدية', false)  -- inactive: not on the roster today
  returning id into d_faisal;

  -- د. أحمد: every slot today already taken.
  insert into public._whatsapp_agent_slots (doctor_id, slot_time, is_booked)
  select d_ahmad, today + t, true
  from unnest(array['10:00','11:00','16:00']::time[]) as t;

  -- د. سارة: open slots today.
  insert into public._whatsapp_agent_slots (doctor_id, slot_time, is_booked)
  select d_sara, today + t, false
  from unnest(array['09:30','13:00','17:30']::time[]) as t;
end $$;

-- Verify:
--   select d.name, s.slot_time, s.is_booked
--   from public._whatsapp_agent_slots s join public._whatsapp_agent_doctors d on d.id = s.doctor_id
--   order by d.name, s.slot_time;
