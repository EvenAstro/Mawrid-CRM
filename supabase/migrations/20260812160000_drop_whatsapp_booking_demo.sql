-- Drops the doctor/slots/bookings demo added in 20260812150000.
--
-- That domain was an illustrative example only, never meant to represent
-- what this product actually does — superseded by the agent now acting on
-- real leads/activities instead (lib/whatsapp/crmTools.ts). Safe to run
-- whether or not the previous migration was ever applied.

drop table if exists public._whatsapp_agent_bookings;
drop table if exists public._whatsapp_agent_slots;
drop table if exists public._whatsapp_agent_doctors;

-- Verify:
--   select table_name from information_schema.tables
--   where table_name like '_whatsapp_agent_%';
--   -- expect only _whatsapp_agent_settings and _whatsapp_agent_log
