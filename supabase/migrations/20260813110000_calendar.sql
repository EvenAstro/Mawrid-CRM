-- Rep calendars: working hours plus the code that finds free slots inside
-- them. The WhatsApp agent uses these to offer real demo times instead of
-- picking "10am tomorrow" and hoping the rep is free — and a plain
-- calendar page reads the same tables so the two views can never diverge.
--
-- Existing tasks (with a due_at) are treated as busy events; there's no
-- separate "events" table on purpose. A task IS the calendar entry. That
-- keeps a rep from having to look at two lists to know their day, and
-- means the tools that already create tasks (schedule_demo,
-- createLeadTask, the parse-note review card) don't need to also mirror
-- them into a second table.

create table if not exists public.user_working_hours (
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  -- 0=Sunday … 6=Saturday. Saudi week is Sunday-Thursday, so the seed
  -- inserts those days and leaves Friday/Saturday off by default.
  weekday     int         not null check (weekday between 0 and 6),
  -- Stored as text 'HH:MM' rather than a time type to make the JSON that
  -- the browser reads round-trip cleanly without timezone gymnastics.
  start_time  text        not null default '09:00',
  end_time    text        not null default '17:00',
  primary key (user_id, weekday)
);

alter table public.user_working_hours enable row level security;

drop policy if exists user_working_hours_read on public.user_working_hours;
create policy user_working_hours_read
  on public.user_working_hours for select to authenticated using (true);

drop policy if exists user_working_hours_write on public.user_working_hours;
create policy user_working_hours_write
  on public.user_working_hours for all to authenticated
  using (user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')))
  with check (user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager')));

-- Seed: any existing sales rep gets Sun-Thu, 9-5 unless they've already
-- been given hours. Runs once on migration and then whenever an admin
-- calls seed_working_hours(user_id) from the admin UI.
create or replace function public.seed_working_hours(p_user_id uuid)
returns void
language sql
as $$
  insert into public.user_working_hours (user_id, weekday, start_time, end_time)
  select p_user_id, d, '09:00', '17:00'
  from generate_series(0, 4) d
  on conflict (user_id, weekday) do nothing;
$$;

do $$
declare u uuid;
begin
  for u in select id from public.profiles where role = 'sales' loop
    perform public.seed_working_hours(u);
  end loop;
end $$;

/**
 * Returns free slots for a user across a date range. "Free" means: falls
 * inside their working hours for that weekday, and doesn't overlap any of
 * their open tasks with a due_at (those are treated as busy events).
 *
 * The slot length is a parameter so the schedule_demo tool can ask for
 * 30-minute demo windows without every other caller having to know.
 * duration_minutes defaults to 30.
 *
 * Times returned as UTC timestamptz. The client formats them in Asia/Riyadh.
 */
create or replace function public.find_available_slots(
  p_user_id           uuid,
  p_from              timestamptz,
  p_to                timestamptz,
  p_duration_minutes  int default 30,
  p_max_slots         int default 5
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
as $$
declare
  d      date;
  wd     int;
  wh     record;
  slot_start timestamptz;
  slot_end   timestamptz;
  found  int := 0;
begin
  d := (p_from at time zone 'Asia/Riyadh')::date;
  while d <= (p_to at time zone 'Asia/Riyadh')::date and found < p_max_slots loop
    -- Postgres EXTRACT(dow) returns 0=Sunday, matching the weekday column.
    wd := extract(dow from d)::int;

    select * into wh from public.user_working_hours
    where user_id = p_user_id and weekday = wd;

    -- FOUND is set by SELECT INTO — true when the row was returned.
    if found then
      slot_start := ((d::text || ' ' || wh.start_time)::timestamp at time zone 'Asia/Riyadh');
      -- Slots are half-hour aligned inside the working window: 9:00,
      -- 9:30, 10:00 … up to end_time - duration.
      while slot_start + (p_duration_minutes || ' minutes')::interval
              <= ((d::text || ' ' || wh.end_time)::timestamp at time zone 'Asia/Riyadh')
            and found < p_max_slots loop

        slot_end := slot_start + (p_duration_minutes || ' minutes')::interval;

        -- Skip anything in the past.
        if slot_start > now() then
          -- Busy = overlapping open task on this user.
          if not exists (
            select 1 from public.tasks t
            where t.assignee_uid = p_user_id
              and t.completed_at is null
              and t.due_at is not null
              and t.due_at <  slot_end
              and (t.due_at + interval '30 minutes') > slot_start
          ) then
            return next;
            found := found + 1;
          end if;
        end if;

        slot_start := slot_start + interval '30 minutes';
      end loop;
    end if;

    d := d + 1;
  end loop;
end;
$$;

grant execute on function public.find_available_slots(uuid, timestamptz, timestamptz, int, int) to authenticated, service_role;
grant execute on function public.seed_working_hours(uuid) to authenticated, service_role;

-- Verify:
--   select public.seed_working_hours('<some-user-uuid>');
--   select * from public.find_available_slots('<some-user-uuid>', now(), now() + interval '7 days');
