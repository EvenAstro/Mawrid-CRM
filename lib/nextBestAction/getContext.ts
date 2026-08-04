import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { SituationalTag } from "@/lib/classifyActivity";

export type MatchTier = "exact" | "stage" | "tag" | "none";

export interface TimelineActivity {
  body: string | null;
  direction: string | null;
  occurred_at: string | null;
}

export interface SimilarDeal {
  dealId: string;
  outcome: "won" | "lost";
  stageLabel: string;
  situationalTag: SituationalTag | null;
  summary: string;
  resolvedAt: string | null;
}

export interface DealContext {
  dealId: string;
  stageId: string | null;
  stageLabel: string;
  stageTerminalType: string | null;
  daysInStage: number;
  timeline: TimelineActivity[];
  /** Total activities feeding this context — used by the API route to detect staleness. */
  activityCount: number;
  similarDeals: SimilarDeal[];
  matchTier: MatchTier;
}

interface RawActivity {
  entity_type: string | null;
  entity_id: string | null;
  direction: string | null;
  occurred_at: string | null;
  body: string | null;
  situational_tag: string | null;
}

interface RawStage {
  label: string;
  terminal_type: string | null;
}

interface RawDeal {
  id: string;
  lead_id: string | null;
  stage_id: string | null;
  updated_at: string | null;
  pipeline_stages: RawStage | null;
}

const CHUNK_SIZE = 50;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Fetches activities scoped to specific deal/lead IDs only — never the whole
 * table. IDs are chunked so a single request never asks for more rows than
 * a couple dozen deals' worth of history, well under Supabase/PostgREST's
 * default 1000-row page cap.
 */
async function fetchActivitiesFor(dealIds: string[], leadIds: string[]): Promise<RawActivity[]> {
  const results: RawActivity[] = [];
  const cols = "entity_type, entity_id, direction, occurred_at, body, situational_tag";

  for (const c of chunk(dealIds, CHUNK_SIZE)) {
    if (!c.length) continue;
    const { data, error } = await supabase.from("activities").select(cols).eq("entity_type", "deal").in("entity_id", c);
    if (error) console.error("[getContext] deal-activities chunk fetch failed", error);
    if (data) results.push(...(data as RawActivity[]));
  }
  for (const c of chunk(leadIds, CHUNK_SIZE)) {
    if (!c.length) continue;
    const { data, error } = await supabase.from("activities").select(cols).eq("entity_type", "lead").in("entity_id", c);
    if (error) console.error("[getContext] lead-activities chunk fetch failed", error);
    if (data) results.push(...(data as RawActivity[]));
  }
  return results;
}

function summarize(activities: RawActivity[]): string {
  const recent = [...activities]
    .filter((a) => a.body)
    .sort((a, b) => new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime())
    .slice(0, 3)
    .reverse();
  return recent.length ? recent.map((a) => `[${a.direction ?? "?"}] ${a.body}`).join(" → ") : "(no activity notes)";
}

interface CandidateDeal {
  id: string;
  lead_id: string | null;
  stage_id: string | null;
  updated_at: string | null;
  outcome: "won" | "lost";
  stageLabel: string;
}

interface EnrichedCandidate extends CandidateDeal {
  situationalTag: SituationalTag | null;
  summary: string;
}

/** Enriches a batch of candidate deals with their situational_tag + summary, fetching only their activities. */
async function enrichCandidates(candidates: CandidateDeal[]): Promise<EnrichedCandidate[]> {
  if (candidates.length === 0) return [];

  const dealIds = candidates.map((c) => c.id);
  const leadIds = candidates.map((c) => c.lead_id).filter((id): id is string => !!id);
  const activities = await fetchActivitiesFor(dealIds, leadIds);

  const byEntity = new Map<string, RawActivity[]>();
  for (const a of activities) {
    if (!a.entity_type || !a.entity_id) continue;
    const key = `${a.entity_type}:${a.entity_id}`;
    if (!byEntity.has(key)) byEntity.set(key, []);
    byEntity.get(key)!.push(a);
  }

  return candidates.map((c) => {
    const dealActs = byEntity.get(`deal:${c.id}`) ?? [];
    const leadActs = c.lead_id ? byEntity.get(`lead:${c.lead_id}`) ?? [] : [];
    const all = [...dealActs, ...leadActs].sort(
      (a, b) => new Date(a.occurred_at ?? 0).getTime() - new Date(b.occurred_at ?? 0).getTime(),
    );
    const resolvedAtMs = c.updated_at ? new Date(c.updated_at).getTime() : Infinity;
    const lastInbound = [...all]
      .reverse()
      .find((a) => a.direction === "inbound" && new Date(a.occurred_at ?? 0).getTime() <= resolvedAtMs);

    return {
      ...c,
      situationalTag: (lastInbound?.situational_tag ?? null) as SituationalTag | null,
      summary: summarize(all),
    };
  });
}

/**
 * There is no audit_log / stage-history table in this schema, so "days in stage"
 * and "when a deal resolved" are both approximated from deals.updated_at — the
 * same column the Kanban board already bumps on every stage move. This can
 * over-count days if a deal was edited without changing stage, but it's the
 * only signal available.
 */
export async function getContext(dealId: string): Promise<DealContext | null> {
  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .select("id, lead_id, stage_id, updated_at, pipeline_stages(label, terminal_type)")
    .eq("id", dealId)
    .single();

  if (dealError || !deal) {
    console.error("[getContext] deal not found", dealError);
    return null;
  }
  const liveDeal = deal as unknown as RawDeal;
  const stage = liveDeal.pipeline_stages;

  const daysInStage = liveDeal.updated_at
    ? Math.max(0, Math.floor((Date.now() - new Date(liveDeal.updated_at).getTime()) / 86_400_000))
    : 0;

  // Targeted fetch — only this deal's own (and its originating lead's) activities.
  const timelineRaw = (
    await fetchActivitiesFor([liveDeal.id], liveDeal.lead_id ? [liveDeal.lead_id] : [])
  ).sort((a, b) => new Date(a.occurred_at ?? 0).getTime() - new Date(b.occurred_at ?? 0).getTime());

  const lastInbound = [...timelineRaw].reverse().find((a) => a.direction === "inbound");
  const liveTag = (lastInbound?.situational_tag ?? null) as SituationalTag | null;

  const baseContext = {
    dealId,
    stageId: liveDeal.stage_id,
    stageLabel: stage?.label ?? "Unknown",
    stageTerminalType: stage?.terminal_type ?? null,
    daysInStage,
    timeline: timelineRaw.map((a) => ({ body: a.body, direction: a.direction, occurred_at: a.occurred_at })),
    activityCount: timelineRaw.length,
  };

  // Deals table is small (~hundreds of rows) — fetching it whole is fine;
  // it's the activities table (thousands of rows) that needs targeted queries.
  const { data: resolvedDealsRaw, error: resolvedError } = await supabase
    .from("deals")
    .select("id, lead_id, stage_id, updated_at, pipeline_stages(label, terminal_type)")
    .is("deleted_at", null)
    .neq("id", liveDeal.id);

  if (resolvedError || !resolvedDealsRaw) {
    console.error("[getContext] resolved deals fetch failed", resolvedError);
    return { ...baseContext, similarDeals: [], matchTier: "none" };
  }

  const allResolved: CandidateDeal[] = [];
  for (const rd of resolvedDealsRaw as unknown as RawDeal[]) {
    const rdStage = rd.pipeline_stages;
    if (rdStage?.terminal_type !== "won" && rdStage?.terminal_type !== "lost") continue;
    allResolved.push({
      id: rd.id,
      lead_id: rd.lead_id,
      stage_id: rd.stage_id,
      updated_at: rd.updated_at,
      outcome: rdStage.terminal_type as "won" | "lost",
      stageLabel: rdStage.label,
    });
  }

  // Tiered matching, cheapest first: only fetch activities for the same-stage
  // subset up front. Widen to the remaining resolved deals only if that
  // subset can't satisfy tier "exact" or "stage" — this is what keeps every
  // query scoped to a few dozen deals instead of the whole table.
  const sameStage = allResolved.filter((c) => c.stage_id === liveDeal.stage_id);
  const rest = allResolved.filter((c) => c.stage_id !== liveDeal.stage_id);

  const enrichedStage = await enrichCandidates(sameStage);

  let tier: MatchTier = "none";
  let matched: EnrichedCandidate[] = [];

  if (liveTag) {
    const exact = enrichedStage.filter((c) => c.situationalTag === liveTag);
    if (exact.length >= 3) {
      tier = "exact";
      matched = exact;
    }
  }
  if (matched.length === 0 && enrichedStage.length >= 3) {
    tier = "stage";
    matched = enrichedStage;
  }

  if (matched.length === 0) {
    // Fall back tier c: search by situation tag across the rest of the resolved
    // deals (only fetched now, on demand).
    const enrichedRest = await enrichCandidates(rest);
    const enrichedAll = [...enrichedStage, ...enrichedRest];

    if (liveTag) {
      const sameTag = enrichedAll.filter((c) => c.situationalTag === liveTag);
      if (sameTag.length > 0) {
        tier = "tag";
        matched = sameTag;
      }
    }
    if (matched.length === 0 && enrichedStage.length > 0) {
      // Absolute last resort: same stage, even below the 3-match threshold.
      tier = "stage";
      matched = enrichedStage;
    }
  }

  matched.sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime());
  const similarDeals: SimilarDeal[] = matched.slice(0, 8).map((c) => ({
    dealId: c.id,
    outcome: c.outcome,
    stageLabel: c.stageLabel,
    situationalTag: c.situationalTag,
    summary: c.summary,
    resolvedAt: c.updated_at,
  }));

  return { ...baseContext, similarDeals, matchTier: tier };
}

/** Cheap activity count for a deal (deal-linked + originating-lead-linked), used for cache staleness checks. */
export async function getActivityCount(dealId: string): Promise<number> {
  const { data: deal } = await supabase.from("deals").select("lead_id").eq("id", dealId).single();
  if (!deal) return 0;

  let query = supabase.from("activities").select("id", { count: "exact", head: true });
  query = deal.lead_id
    ? query.or(`and(entity_type.eq.deal,entity_id.eq.${dealId}),and(entity_type.eq.lead,entity_id.eq.${deal.lead_id})`)
    : query.eq("entity_type", "deal").eq("entity_id", dealId);

  const { count } = await query;
  return count ?? 0;
}

/** Cheap staleness signals for cache reads: current activity count + current stage_id. */
export async function getDealMeta(dealId: string): Promise<{ activityCount: number; stageId: string | null }> {
  const { data: deal } = await supabase.from("deals").select("lead_id, stage_id").eq("id", dealId).single();
  if (!deal) return { activityCount: 0, stageId: null };

  let query = supabase.from("activities").select("id", { count: "exact", head: true });
  query = deal.lead_id
    ? query.or(`and(entity_type.eq.deal,entity_id.eq.${dealId}),and(entity_type.eq.lead,entity_id.eq.${deal.lead_id})`)
    : query.eq("entity_type", "deal").eq("entity_id", dealId);

  const { count } = await query;
  return { activityCount: count ?? 0, stageId: deal.stage_id ?? null };
}
