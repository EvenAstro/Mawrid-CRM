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
