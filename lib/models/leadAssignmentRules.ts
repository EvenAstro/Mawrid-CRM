import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Lead assignment rules — data access.
 *
 * The rules table is small (a handful of rows per company at most) so
 * every read pulls the whole thing rather than paginating. Writes go
 * through the browser client so RLS enforces the admin/manager gate the
 * migration set up. resolveAssignment is the one call the WhatsApp
 * webhook uses; that runs with the admin client because the webhook has
 * no signed-in user to authenticate as.
 */

export type AssignmentActionType = "assign_user" | "round_robin_pool" | "unassigned";

export interface AssignmentConditions {
  industry?: string;
  min_size?: number;
  max_size?: number;
  source?: string;
}

export interface LeadAssignmentRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: AssignmentConditions;
  action_type: AssignmentActionType;
  assignee_id: string | null;
  pool_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

export async function fetchAssignmentRules(): Promise<LeadAssignmentRule[]> {
  const { data, error } = await supabase
    .from("lead_assignment_rules")
    .select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[assignment rules] read failed", error);
    return [];
  }
  return (data as LeadAssignmentRule[]) ?? [];
}

export interface NewRuleInput {
  name: string;
  priority: number;
  enabled: boolean;
  conditions: AssignmentConditions;
  action_type: AssignmentActionType;
  assignee_id: string | null;
  pool_ids: string[] | null;
}

export async function upsertAssignmentRule(id: string | null, input: NewRuleInput) {
  const now = new Date().toISOString();
  if (id) {
    return supabase.from("lead_assignment_rules").update({ ...input, updated_at: now }).eq("id", id);
  }
  return supabase.from("lead_assignment_rules").insert({ ...input, created_at: now, updated_at: now });
}

export async function deleteAssignmentRule(id: string) {
  return supabase.from("lead_assignment_rules").delete().eq("id", id);
}

/**
 * Server-side call — the assign_lead tool in the WhatsApp agent uses this
 * once a new lead is created. Runs with the admin client because the
 * webhook has no browser session, and the RPC itself is granted to
 * service_role. Returns null on failure so the caller can carry on with
 * an unassigned lead rather than blocking on assignment.
 */
export interface AssignmentResult {
  assignee_id: string | null;
  rule_id: string | null;
  rule_name: string | null;
}
export async function resolveLeadAssignment(input: {
  leadId: string;
  industry: string | null;
  size: number | null;
  source: string | null;
}): Promise<AssignmentResult | null> {
  const { data, error } = await supabaseAdmin.rpc("resolve_lead_assignment", {
    p_lead_id: input.leadId,
    p_industry: input.industry,
    p_size: input.size,
    p_source: input.source,
  });
  if (error) {
    console.error("[assignment rules] resolve failed", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    assignee_id: row.assignee_id ?? null,
    rule_id: row.rule_id ?? null,
    rule_name: row.rule_name ?? null,
  };
}

/** Sets a lead's owner. Used from the assign_lead tool after resolution. */
export async function setLeadOwner(leadId: string, ownerId: string | null) {
  const { error } = await supabaseAdmin
    .from("leads")
    .update({ owner_id: ownerId, updated_at: new Date().toISOString() })
    .eq("id", leadId);
  if (error) console.error("[assignment rules] setLeadOwner failed", error);
  return { error };
}
