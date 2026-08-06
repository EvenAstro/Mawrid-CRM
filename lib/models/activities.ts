import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { canViewAllData } from "@/lib/permissions";
import type { Role } from "@/lib/profiles";
import { fetchOwnedLeadIds } from "@/lib/models/leads";
import { fetchOwnedDealIds } from "@/lib/models/deals";

/** Data-access layer for the `activities` table. */

export interface Activity {
  id: string;
  body: string | null;
  occurred_at: string | null;
  direction: string | null;
  entity_type: string | null;
  entity_id: string | null;
  activity_types: { label: string; color: string | null } | null;
}

/**
 * Loads one page of activities, scoped to the leads/deals the rep owns
 * unless they can see all data — activities have no owner_id of their own,
 * so the boundary is applied via the entities they're attached to.
 */
export async function fetchActivitiesPage(
  role: Role | null,
  userId: string | null,
  limit: number,
): Promise<{ activities: Activity[]; total: number }> {
  let ownedLeadIds: string[] | null = null;
  let ownedDealIds: string[] | null = null;
  if (!canViewAllData(role) && userId) {
    const [leadIds, dealIds] = await Promise.all([fetchOwnedLeadIds(userId), fetchOwnedDealIds(userId)]);
    ownedLeadIds = leadIds.map(String);
    ownedDealIds = dealIds.map(String);
    if (ownedLeadIds.length === 0 && ownedDealIds.length === 0) {
      return { activities: [], total: 0 };
    }
  }

  let query = supabase
    .from("activities")
    .select("*, activity_types(label, color)", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range(0, limit - 1);

  if (ownedLeadIds != null && ownedDealIds != null) {
    const clauses: string[] = [];
    if (ownedLeadIds.length) clauses.push(`and(entity_type.eq.lead,entity_id.in.(${ownedLeadIds.join(",")}))`);
    if (ownedDealIds.length) clauses.push(`and(entity_type.eq.deal,entity_id.in.(${ownedDealIds.join(",")}))`);
    query = query.or(clauses.join(","));
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const activities = (data as unknown as Activity[]) || [];
  return { activities, total: count ?? activities.length };
}

/** Most recent activities across the whole app — used by the dashboard home page. */
export async function fetchRecentActivities(limit: number) {
  return supabase.from("activities").select("*, activity_types(label)").order("occurred_at", { ascending: false }).limit(limit);
}

export interface NewActivityInput {
  entityType: string;
  entityId: string | number;
  activityTypeId?: string | null;
  body: string | null;
  direction: string;
  occurredAt: string;
  userId: string | null;
}

/** Logs a new activity — used by every "log activity" form/action in the app. */
export async function createActivity(input: NewActivityInput): Promise<{ error: Error | null; id: string }> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("activities").insert({
    id,
    entity_type: input.entityType,
    entity_id: input.entityId,
    activity_type_id: input.activityTypeId ?? null,
    body: input.body,
    direction: input.direction,
    occurred_at: input.occurredAt,
    user_id: input.userId,
    created_at: now,
    updated_at: now,
  });
  return { error, id };
}

/** Just the occurred_at timestamps — used by the insights builder's activity trend chart. */
export async function fetchActivityTimestamps() {
  return supabase.from("activities").select("occurred_at");
}

/**
 * Every activity for a given entity (deal or lead), server-side full read —
 * used by the deal investigation report, which needs to see all activity
 * regardless of RLS ownership scoping.
 */
export async function fetchEntityActivitiesAdmin(client: SupabaseClient, entityType: string, entityId: string) {
  return client
    .from("activities")
    .select("id, body, direction, occurred_at, situational_tag, activity_types(label)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
}

/** Activities matching a batch of entity ids (deal or lead) — chunked-caller-scoped read for context builders. */
export async function fetchActivitiesByEntityIds(client: SupabaseClient, entityType: string, entityIds: string[]) {
  return client
    .from("activities")
    .select("entity_type, entity_id, direction, occurred_at, body, situational_tag")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds);
}

/** Exact count of activities matching a raw filter expression — used by the next-best-action context builder. */
export async function countActivitiesMatching(client: SupabaseClient, orFilter: string | null, entityType?: string, entityId?: string) {
  let query = client.from("activities").select("id", { count: "exact", head: true });
  query = orFilter ? query.or(orFilter) : query.eq("entity_type", entityType!).eq("entity_id", entityId!);
  return query;
}

/** Occurred-at timestamps for a batch of entity ids — used to find each deal's last-activity date. */
export async function fetchActivityTimestampsByEntityIds(entityType: string, entityIds: string[]) {
  return supabase.from("activities").select("entity_type, entity_id, occurred_at").eq("entity_type", entityType).in("entity_id", entityIds);
}

/**
 * Writes a system-generated activity row (is_system=true, activity_type_id=null).
 * Falls back to inserting without is_system if that column isn't present yet
 * on a given Supabase project.
 */
export async function insertSystemActivity(leadId: string | number, userId: string | null, message: string): Promise<void> {
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    entity_type: "lead",
    entity_id: String(leadId),
    activity_type_id: null,
    body: message,
    direction: null,
    is_system: true,
    occurred_at: now,
    user_id: userId,
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from("activities").insert(row);
  if (error) {
    console.error("[insertSystemActivity] insert failed, retrying without is_system", error);
    const fallback: Partial<typeof row> = { ...row };
    delete fallback.is_system;
    await supabase.from("activities").insert(fallback);
  }
}

/** Deal-linked activities since a given date — used by the revenue intelligence weekly chart. */
export async function fetchDealActivitiesSince(sinceIso: string) {
  return supabase.from("activities").select("entity_id, entity_type, occurred_at").eq("entity_type", "deal").gte("occurred_at", sinceIso);
}

/** The 12 most recent activities app-wide — used by the Copilot business snapshot. */
export async function fetchRecentActivitiesAdmin(client: SupabaseClient, limit = 12) {
  return client
    .from("activities")
    .select("entity_type, entity_id, body, direction, occurred_at, activity_types(label)")
    .order("occurred_at", { ascending: false })
    .limit(limit);
}

/** The single most recent activity's timestamp — used to anchor "now" for historical datasets. */
export async function fetchLatestActivityTimestamp(client: SupabaseClient) {
  return client.from("activities").select("occurred_at").order("occurred_at", { ascending: false }).limit(1);
}

/** Today's activities by this rep, for the rep-coach briefing's outbound-count calc. */
export async function fetchRepCoachTodayActivities(client: SupabaseClient, userId: string, dayStartIso: string, dayEndIso: string) {
  return client.from("activities").select("id, entity_type, entity_id, direction, occurred_at")
    .eq("user_id", userId).gte("occurred_at", dayStartIso).lt("occurred_at", dayEndIso);
}

/** Upcoming meetings (activities tagged "meeting") in the next N days, for the rep-coach briefing. */
export async function fetchRepCoachUpcomingMeetings(client: SupabaseClient, userId: string, fromIso: string, toIso: string) {
  return client.from("activities").select("id, body, occurred_at, activity_types!inner(label)")
    .eq("user_id", userId).gte("occurred_at", fromIso).lte("occurred_at", toIso)
    .ilike("activity_types.label", "%meeting%")
    .order("occurred_at", { ascending: true }).limit(10);
}

/** Most recent activities on a lead, for LeadSlideOver's activity tab. */
export async function fetchLeadActivities(leadId: string | number, limit = 30) {
  return supabase
    .from("activities")
    .select("*, activity_types(label)")
    .eq("entity_id", leadId)
    .eq("entity_type", "lead")
    .order("occurred_at", { ascending: false })
    .limit(limit);
}

/** Sets an activity's situational tag after AI classification. */
export async function setActivitySituationalTag(client: SupabaseClient, activityId: string, tag: string): Promise<{ error: Error | null }> {
  const { error } = await client.from("activities").update({ situational_tag: tag, tag_computed_at: new Date().toISOString() }).eq("id", activityId);
  return { error };
}

/** Outbound activities since a date, by user — used by the rep leaderboard. */
export async function fetchOutboundActivitiesSince(sinceIso: string) {
  return supabase.from("activities").select("user_id, direction, occurred_at").eq("direction", "outbound").gte("occurred_at", sinceIso);
}
