import { supabase } from "@/lib/supabase";
import { canViewAllData } from "@/lib/permissions";
import type { Role } from "@/lib/profiles";

/** Data-access layer for the `deals` and `pipeline_stages` (deal pipeline) tables. */

export interface Deal {
  id: string;
  name: string | null;
  stage_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  currency_code: string | null;
  probability_pct: number | null;
  target_close_date: string | null;
  notes: string | null;
  pipeline_stages: { label: string; color: string | null; terminal_type: string | null } | null;
  lost_reasons: { label: string } | null;
}

export interface StageCol {
  id: string;
  label: string;
  color: string | null;
  sort_order: number;
  terminal_type: string | null;
}

/**
 * Loads the deals board: every deal visible to the role (scoped to the rep
 * unless they can see all data), plus the deal pipeline's stage columns.
 */
export async function fetchDealsBoard(
  role: Role | null,
  userId: string | null,
): Promise<{ deals: Deal[]; stages: StageCol[] }> {
  let dealsQuery = supabase
    .from("deals")
    .select("*, pipeline_stages(label, color, terminal_type), lost_reasons(label)", { count: "exact" })
    .is("deleted_at", null)
    .limit(2000);
  if (!canViewAllData(role) && userId) {
    dealsQuery = dealsQuery.eq("owner_id", userId);
  }

  const [d, s] = await Promise.all([
    dealsQuery,
    supabase.from("pipeline_stages").select("*").eq("pipeline", "deal").order("sort_order"),
  ]);

  if (d.error) throw d.error;
  if (s.error) throw s.error;

  if (d.count != null && d.data && d.count > d.data.length) {
    console.warn(`[deals model] loaded ${d.data.length} of ${d.count} deals — hit the 2000-row cap, consider server-side pagination`);
  }

  return {
    deals: (d.data as unknown as Deal[]) ?? [],
    stages: (s.data as unknown as StageCol[]) ?? [],
  };
}

/** Moves a deal to a new pipeline stage. */
export async function moveDealStage(dealId: string, toStageId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("deals")
    .update({ stage_id: toStageId, updated_at: new Date().toISOString() })
    .eq("id", dealId);
  return { error };
}

/** Ids of deals owned by the given user (used to scope the activities page). */
export async function fetchOwnedDealIds(userId: string): Promise<(string | number)[]> {
  const { data, error } = await supabase.from("deals").select("id").eq("owner_id", userId).is("deleted_at", null);
  if (error) throw error;
  return (data ?? []).map((r) => r.id);
}

/** Compact summary select used by the dashboard home page's overview widgets. */
export async function fetchDealsSummary() {
  return supabase.from("deals").select("*, pipeline_stages(label, terminal_type)").is("deleted_at", null);
}
