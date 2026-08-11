import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canViewAllData } from "@/lib/permissions";
import type { Role } from "@/lib/profiles";

/** Data-access layer for the `deals` and `pipeline_stages` (deal pipeline) tables. */

export interface Deal {
  id: string;
  name: string | null;
  /** Who carries this deal. Selected by `*` all along; typed only once the
   * team board and the deals owner filter needed to read it. */
  owner_id: string | null;
  created_at: string | null;
  /**
   * Last modification. NOT a close date, and it must not be used as one.
   *
   * There is no closed_at column. Several places treat updated_at as a proxy
   * for when a deal was won or lost, and it is wrong every time the row is
   * touched afterwards — which happens on any edit, including a note.
   *
   * This has already cost one feature: proposal 86 (reviving lost deals whose
   * reason has expired) needed "how long since this closed" and was dropped,
   * because all 193 lost deals report updated_at within the last 90 days and
   * the elapsed-time filter selected zero rows.
   *
   * Anything reaching for time-since-close needs a real closed_at column
   * written at the stage transition first. deal_stage_history records the
   * transitions and is the natural source once it has depth.
   */
  updated_at: string | null;
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
export async function moveDealStage(
  dealId: string,
  toStageId: string,
  fromStageId?: string | null,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("deals")
    .update({ stage_id: toStageId, updated_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) return { error };

  // Log the transition after the move succeeds, never before — a logged
  // transition that didn't happen is worse than a missing one.
  await recordStageTransition(dealId, fromStageId ?? null, toStageId);
  return { error: null };
}

/**
 * Appends to deal_stage_history. Deliberately fails soft: this is a log, and
 * a log must never be the reason a rep can't move a deal. If the table hasn't
 * been created yet (see supabase/migrations/), or RLS rejects the insert, the
 * move still stands and we record the reason in the console.
 *
 * Nothing reads this table yet — velocity and funnel-conversion are later
 * work. It ships now because a stage change that was never logged cannot be
 * reconstructed from the deals table afterwards.
 */
async function recordStageTransition(
  dealId: string,
  fromStageId: string | null,
  toStageId: string,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("deal_stage_history").insert({
      deal_id: dealId,
      from_stage_id: fromStageId,
      to_stage_id: toStageId,
      changed_by: user.id,
      changed_at: new Date().toISOString(),
    });
    if (error) console.warn("[deals] stage transition not logged", error.message);
  } catch (err) {
    console.warn("[deals] stage transition not logged", err);
  }
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

export interface NewDealInput {
  name: string;
  leadId: string | null;
  stageId: string | null;
  expectedValueMinor: number | null;
  currencyCode: string;
  probabilityPct: number;
  targetCloseDate: string | null;
  notes: string | null;
  ownerId: string | null;
}

/** Creates a new deal. */
export async function createDeal(input: NewDealInput): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("deals").insert({
    id: crypto.randomUUID(),
    name: input.name,
    lead_id: input.leadId,
    stage_id: input.stageId,
    expected_value_minor: input.expectedValueMinor,
    currency_code: input.currencyCode,
    probability_pct: input.probabilityPct,
    target_close_date: input.targetCloseDate,
    notes: input.notes,
    owner_id: input.ownerId,
    created_at: now,
    updated_at: now,
  });
  return { error };
}

/** Global command-palette search — deals matching name. */
export async function searchDealsForPalette(likePattern: string, limit = 5) {
  return supabase.from("deals").select("id, name").is("deleted_at", null).ilike("name", likePattern).limit(limit);
}

/** Full select for the insights builder — every field the charts/tables need. */
export async function fetchDealsForInsights() {
  return supabase
    .from("deals")
    .select(
      "id, name, lead_id, stage_id, expected_value_minor, won_value_minor, probability_pct, created_at, updated_at, pipeline_stages(id, label, color, terminal_type, sort_order), lost_reasons(label), leads(full_name)",
    )
    .is("deleted_at", null);
}

/** Full deal record for the investigation report — server-side, no RLS scoping. */
export async function fetchDealForInvestigation(dealId: string) {
  return supabaseAdmin
    .from("deals")
    .select(
      "id, name, lead_id, expected_value_minor, won_value_minor, currency_code, created_at, updated_at, pipeline_stages(label, terminal_type)",
    )
    .eq("id", dealId)
    .single();
}

/** Value/timing fields for a batch of deals — used to enrich "similar deals" comparisons. */
export async function fetchDealValuesByIds(ids: string[]) {
  return supabaseAdmin.from("deals").select("id, expected_value_minor, won_value_minor, created_at, updated_at").in("id", ids);
}

/** A deal's stage/lead linkage, for the next-best-action context builder. */
export async function fetchDealStageContext(dealId: string) {
  return supabaseAdmin.from("deals").select("id, lead_id, stage_id, updated_at, pipeline_stages(label, terminal_type)").eq("id", dealId).single();
}

/** Every non-deleted deal's stage/lead linkage except the given one — used to find "similar" resolved deals. */
export async function fetchResolvedDealsExcept(excludeDealId: string) {
  return supabaseAdmin
    .from("deals")
    .select("id, lead_id, stage_id, updated_at, pipeline_stages(label, terminal_type)")
    .is("deleted_at", null)
    .neq("id", excludeDealId);
}

/** A deal's lead_id only — used before an activity-count lookup. */
export async function fetchDealLeadId(dealId: string) {
  return supabaseAdmin.from("deals").select("lead_id").eq("id", dealId).single();
}

/** A deal's lead_id and stage_id — used before an activity-count + stage lookup. */
export async function fetchDealLeadAndStage(dealId: string) {
  return supabaseAdmin.from("deals").select("lead_id, stage_id").eq("id", dealId).single();
}

/** The 30 least-recently-updated active deals, for the daily briefing's "stuck deals" section. */
export async function fetchStaleDealsForBriefing() {
  return supabase
    .from("deals")
    .select("id, name, lead_id, updated_at, expected_value_minor, leads(full_name), pipeline_stages(terminal_type)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .limit(30);
}


/** Full select for the revenue intelligence builder. */
export async function fetchDealsForRevenueIntelligence() {
  return supabase
    .from("deals")
    .select(
      "id, name, expected_value_minor, won_value_minor, probability_pct, created_at, updated_at, stage_id, pipeline_stages(id, label, color, terminal_type, sort_order), leads(full_name)",
    )
    .is("deleted_at", null);
}

/** Full select for the Copilot business snapshot. */
export async function fetchDealsForSnapshot() {
  return supabaseAdmin
    .from("deals")
    .select(
      "id, name, lead_id, expected_value_minor, won_value_minor, currency_code, probability_pct, created_at, updated_at, pipeline_stages(label, terminal_type), lost_reasons(label)",
    )
    .is("deleted_at", null);
}

/** Active deals stale for 7+ days, for the rep-coach briefing. */
export async function fetchRepCoachStaleDeals(staleBeforeIso: string) {
  return supabaseAdmin.from("deals").select("id, name, updated_at, expected_value, leads(full_name)")
    .is("deleted_at", null).is("closed_at", null).lt("updated_at", staleBeforeIso)
    .order("updated_at", { ascending: true }).limit(10);
}

/** Top 5 active deals by expected value, for the rep-coach briefing. */
export async function fetchRepCoachBigDeals() {
  return supabaseAdmin.from("deals").select("id, name, expected_value, stage, updated_at, leads(full_name)")
    .is("deleted_at", null).is("closed_at", null)
    .order("expected_value", { ascending: false }).limit(5);
}

/** 20 most recently created active deals, for the rep-coach briefing's pipeline view. */
export async function fetchRepCoachPipeline() {
  return supabaseAdmin.from("deals").select("id, name, stage, expected_value, leads(full_name)")
    .is("deleted_at", null).is("closed_at", null)
    .order("created_at", { ascending: false }).limit(20);
}

/** Deals in a quote/proposal stage (Arabic "عرض") stale for 3+ days, for the rep-coach briefing. */
export async function fetchRepCoachQuoteDeals(staleBeforeIso: string) {
  return supabaseAdmin.from("deals").select("id, name, expected_value, updated_at, leads(full_name), pipeline_stages!inner(label)")
    .is("deleted_at", null).is("closed_at", null).lt("updated_at", staleBeforeIso)
    .ilike("pipeline_stages.label", "%عرض%")
    .order("updated_at", { ascending: true }).limit(10);
}

/** Owner/value/stage fields since a date — used by the rep leaderboard. */
export async function fetchDealsForLeaderboard(sinceIso: string) {
  return supabase
    .from("deals")
    .select("owner_id, won_value_minor, expected_value_minor, updated_at, pipeline_stages(terminal_type)")
    .is("deleted_at", null)
    .gte("updated_at", sinceIso);
}

/** Stale open deals, for the notifications dropdown. */
export async function fetchNotifStuckDeals(staleBeforeIso: string) {
  return supabase.from("deals").select("id, name, updated_at, expected_value")
    .is("closed_at", null).lt("updated_at", staleBeforeIso)
    .order("updated_at", { ascending: true }).limit(5);
}

/** Deals with their owner and stage — feeds the team view (proposal 67).
 * Scoped by RLS to what the caller may see, so a rep opening this screen
 * sees only their own row rather than an empty table. */
export async function fetchDealsForTeam() {
  return supabase
    .from("deals")
    .select("id, name, owner_id, expected_value_minor, won_value_minor, pipeline_stages(label, terminal_type)")
    .is("deleted_at", null)
    .limit(2000);
}
