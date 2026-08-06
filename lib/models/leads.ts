import { supabase } from "@/lib/supabase";
import { canViewAllData } from "@/lib/permissions";
import type { Role } from "@/lib/profiles";
import type { Lead } from "@/components/LeadSlideOver";

/**
 * Data-access layer for the `leads` table — every `supabase.from("leads")`
 * call in the app goes through here instead of being written inline in a
 * page or component. Pages describe *what* they need; this file is the only
 * place that knows the actual columns/joins involved.
 */

/**
 * Loads every lead visible to the given role, scoped to the signed-in rep
 * unless they can see all data (manager/admin). Mirrors the leads list
 * page's original inline query exactly — same select, same 2000-row cap.
 */
export async function fetchLeads(role: Role | null, userId: string | null): Promise<Lead[]> {
  let query = supabase
    .from("leads")
    .select(
      `*, phone:normalized_phone, email:normalized_email, pipeline_stages(label, color), sources(label), junk_reasons(label)`,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    // Explicit cap so growth past this doesn't silently drop leads off the
    // bottom of the list — without an explicit range PostgREST applies its
    // own default (1000) with no client-visible signal that rows were cut.
    .limit(2000);

  if (!canViewAllData(role) && userId) {
    query = query.eq("owner_id", userId);
  }

  const { data, error, count } = await query;
  if (count != null && data && count > data.length) {
    console.warn(`[leads model] loaded ${data.length} of ${count} leads — hit the 2000-row cap, consider server-side pagination`);
  }
  if (error) throw error;
  return (data ?? []) as unknown as Lead[];
}

/** Soft-deletes the given leads (sets deleted_at, doesn't remove the row). */
export async function softDeleteLeads(ids: (string | number)[]): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("leads").update({ deleted_at: new Date().toISOString() }).in("id", ids);
  return { error };
}

/** Minimal shape used when other pages just need id → name lookups. */
export interface LeadRef {
  id: string | number;
  full_name: string | null;
}

/** Loads id/name only, for the given lead ids — used by the activities page. */
export async function fetchLeadRefs(ids: (string | number)[]): Promise<LeadRef[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("leads").select("id, full_name").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

/** Ids of leads owned by the given user (used to scope the activities page). */
export async function fetchOwnedLeadIds(userId: string): Promise<(string | number)[]> {
  const { data, error } = await supabase.from("leads").select("id").eq("owner_id", userId).is("deleted_at", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

/** Compact summary select used by the dashboard home page's overview widgets. */
export async function fetchLeadsSummary() {
  return supabase.from("leads").select("*, sources(label), pipeline_stages(label, terminal_type)").is("deleted_at", null);
}
