import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

/**
 * Verifies the caller's Supabase access token on server-only API routes that
 * would otherwise be reachable by anyone (no session, no Supabase RLS check
 * happens on a plain fetch to a Next.js route handler). Every route that
 * touches CRM data or spends the shared OpenRouter budget must call this
 * first and bail out on `null`.
 */
export async function requireUser(req: NextRequest): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id };
}
