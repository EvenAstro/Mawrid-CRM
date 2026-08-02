import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

/**
 * Server-only client for internal AI/analysis routes (deal investigation,
 * copilot snapshot, next-best-action, ...). These run in a Next.js API
 * route with no browser session attached, so the anon key has no
 * auth.uid() and gets blocked by the leads/deals/tasks RLS policies that
 * scope rows to their owner. They're already gated by the app's own
 * page-level feature permissions and only ever invoked from the logged-in
 * dashboard, so bypassing RLS here restores their original (pre-RLS)
 * behavior instead of silently 404ing.
 *
 * Falls back to the anon key if the service key isn't configured, so
 * local dev without it still runs (just re-blocked by RLS, same as
 * before this file existed).
 */
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
);
