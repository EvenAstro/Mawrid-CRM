import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { canViewAllData } from "@/lib/permissions";
import type { Role } from "@/lib/profiles";

/**
 * Data-access layer for the `leads` table — every `supabase.from("leads")`
 * call in the app goes through here instead of being written inline in a
 * page or component. Pages describe *what* they need; this file is the only
 * place that knows the actual columns/joins involved.
 */

export interface Lead {
  id: string | number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  owner: string | null;
  created_at: string | null;
  junk_reason_id: number | null;
  establishment_id?: number | string | null;
  establishment_name?: string | null;
  notes?: string | null;
  contact_outcome?: string | null;
  contact_outcome_at?: string | null;
  pipeline_stages: { label: string; color: string | null } | null;
  sources: { label: string } | null;
  junk_reasons: { label: string } | null;
}

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

/** Searches leads by name for the deal/quick-search pickers (autocomplete). */
export async function searchLeadsByName(query: string, limit = 6): Promise<LeadRef[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name")
    .ilike("full_name", `%${query}%`)
    .is("deleted_at", null)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export interface NewLeadInput {
  fullName: string;
  normalizedPhone: string | null;
  primarySourceId: string | null;
  stageId: string | null;
  notes: string | null;
  ownerId: string | null;
}

/** Creates a new lead. */
export async function createLead(input: NewLeadInput): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("leads").insert({
    id: crypto.randomUUID(),
    full_name: input.fullName,
    normalized_phone: input.normalizedPhone,
    primary_source_id: input.primarySourceId,
    stage_id: input.stageId,
    notes: input.notes,
    owner_id: input.ownerId,
    created_at: now,
    updated_at: now,
  });
  return { error };
}

/** Global command-palette search — leads matching name or company. */
export async function searchLeadsForPalette(likePattern: string, limit = 5) {
  return supabase.from("leads").select("id, full_name, company_name").is("deleted_at", null).or(`full_name.ilike.${likePattern},company_name.ilike.${likePattern}`).limit(limit);
}

/** Marks a lead as having responded, with the timestamp used to patch UI state. */
export async function markLeadResponded(leadId: string | number, at: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("leads")
    .update({ contact_outcome: "responded", contact_outcome_at: at, updated_at: at })
    .eq("id", leadId);
  return { error };
}

/** Marks a lead as junk with the given reason. */
export async function markLeadJunk(leadId: string | number, reasonId: string, at: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("leads").update({ junk_reason_id: reasonId, updated_at: at }).eq("id", leadId);
  return { error };
}

/** Applies an arbitrary partial patch to a lead (edit form save). */
export async function updateLead(leadId: string | number, patch: Record<string, unknown>): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  return { error };
}

/** Marks a lead as not having responded, with the timestamp used to patch UI state. */
export async function markLeadNoResponse(leadId: string | number, at: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("leads")
    .update({ contact_outcome: "no_response", contact_outcome_at: at, updated_at: at })
    .eq("id", leadId);
  return { error };
}

/** Minimal select for the insights builder — id/date/junk/source only. */
export async function fetchLeadsForInsights() {
  return supabase.from("leads").select("id, created_at, junk_reason_id, sources(label)").is("deleted_at", null);
}

/** Minimal select for the Copilot business snapshot. */
export async function fetchLeadsForSnapshot() {
  return supabaseAdmin.from("leads").select("id, junk_reason_id, created_at, sources(label)").is("deleted_at", null);
}

/** Leads created in the last N days, for the rep-coach briefing. */
export async function fetchRepCoachNewLeads(sinceIso: string) {
  return supabaseAdmin.from("leads").select("id, full_name, company_name, created_at")
    .is("deleted_at", null).gte("created_at", sinceIso)
    .order("created_at", { ascending: false }).limit(10);
}

/** Leads created in the last day, for the notifications dropdown. */
export async function fetchNotifNewLeads(sinceIso: string) {
  return supabase.from("leads").select("id, company_name, created_at")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false }).limit(5);
}

/** Contact details for one lead — feeds the deal panel's contact block.
 * `phone` aliases normalized_phone, matching fetchLeads, so callers get one
 * shape regardless of which query produced the row. */
export async function fetchLeadContact(leadId: string | number) {
  return supabase
    .from("leads")
    .select("id, full_name, company_name, phone:normalized_phone, email:normalized_email")
    .eq("id", leadId)
    .maybeSingle();
}

/** Contacts for many leads at once — the call queue needs a phone per deal. */
export async function fetchLeadContactsByIds(ids: (string | number)[]) {
  return supabase
    .from("leads")
    .select("id, full_name, company_name, phone:normalized_phone")
    .in("id", ids);
}
