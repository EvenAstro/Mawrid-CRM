import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Bridges the WhatsApp agent to the real CRM data — leads, deals, activities.
 * Everything here runs with the admin client: the caller is the webhook
 * route, which has no browser session, and matching a stranger's phone
 * number against the leads table is exactly the kind of read normal RLS
 * would (correctly) block a browser session from doing broadly.
 */

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Saudi numbers show up in the leads table in several shapes (with/without
 *  country code, with/without a leading 0). Comparing the last 9 digits
 *  matches regardless of which shape either side used. */
function last9(s: string): string {
  return digitsOnly(s).slice(-9);
}

export interface CrmLeadContext {
  leadId: string;
  fullName: string | null;
  companyName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  stageLabel: string | null;
  deals: { id: string; name: string | null; stageLabel: string | null }[];
  recentActivities: { body: string | null; occurredAt: string | null }[];
}

/**
 * Finds the lead this WhatsApp number belongs to, with enough surrounding
 * context (owner, open deals, recent activity) for the agent to answer
 * "where do I stand with you?" without a second round trip.
 */
export async function findLeadByPhone(waFrom: string): Promise<CrmLeadContext | null> {
  const target = last9(waFrom);
  if (target.length < 7) return null; // too short to match safely

  const { data: candidates, error } = await supabaseAdmin
    .from("leads")
    .select("id, full_name, owner_id, normalized_phone, created_at, pipeline_stages(label)")
    .not("normalized_phone", "is", null)
    .is("deleted_at", null)
    .ilike("normalized_phone", `%${target}%`)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) {
    console.error("[whatsapp crm] findLeadByPhone lookup failed", error);
    return null;
  }

  type Row = {
    id: string;
    full_name: string | null;
    owner_id: string | null;
    normalized_phone: string | null;
    pipeline_stages: { label: string } | null;
  };
  const lead = ((candidates as unknown as Row[]) ?? []).find((r) => last9(r.normalized_phone ?? "") === target);
  if (!lead) return null;

  const [{ data: owner }, { data: deals }, { data: activities }] = await Promise.all([
    lead.owner_id
      ? supabaseAdmin.from("profiles").select("full_name, first_name, last_name, email").eq("id", lead.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("deals")
      .select("id, name, pipeline_stages(label)")
      .eq("lead_id", lead.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("activities")
      .select("body, occurred_at")
      .eq("entity_type", "lead")
      .eq("entity_id", lead.id)
      .order("occurred_at", { ascending: false })
      .limit(5),
  ]);

  const ownerRow = owner as { full_name: string | null; first_name: string | null; last_name: string | null; email: string | null } | null;

  return {
    leadId: String(lead.id),
    fullName: lead.full_name,
    // No dedicated company/establishment column on leads to read here —
    // whatever business info was captured lives in the notes text instead
    // (see createLeadFromWhatsApp).
    companyName: null,
    ownerId: lead.owner_id,
    ownerName: ownerRow ? ownerRow.full_name || [ownerRow.first_name, ownerRow.last_name].filter(Boolean).join(" ") || null : null,
    ownerEmail: ownerRow?.email ?? null,
    stageLabel: lead.pipeline_stages?.label ?? null,
    deals: ((deals as unknown as { id: string; name: string | null; pipeline_stages: { label: string } | null }[]) ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      stageLabel: d.pipeline_stages?.label ?? null,
    })),
    recentActivities: ((activities as { body: string | null; occurred_at: string | null }[]) ?? []).map((a) => ({
      body: a.body,
      occurredAt: a.occurred_at,
    })),
  };
}

/** Finds (or, on first use, creates) the "واتساب" lead source so new leads
 *  from this agent are visibly attributed rather than landing on whatever
 *  source happens to sort first. */
async function whatsappSourceId(): Promise<string | null> {
  const { data: existing } = await supabaseAdmin.from("sources").select("id").ilike("label", "%واتساب%").limit(1).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("sources")
    .insert({ id: crypto.randomUUID(), label: "واتساب", is_archived: false, sort_order: 999 })
    .select("id")
    .single();
  if (error) {
    console.error("[whatsapp crm] failed to create واتساب source", error);
    return null;
  }
  return created.id;
}

/** The first stage of the lead pipeline, by sort order — where a fresh
 *  lead belongs. */
async function firstLeadStageId(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline", "lead")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    console.error("[whatsapp crm] no lead pipeline stage found", error);
    return null;
  }
  return data.id;
}

/**
 * Creates a lead captured over WhatsApp. Deliberately owner-less — see the
 * migration/agent docs: an unassigned lead surfaces in the existing "no
 * owner" views rather than this agent guessing who should get it.
 */
export async function createLeadFromWhatsApp(input: {
  waFrom: string;
  fullName: string;
  companyName: string | null;
  notes: string;
}): Promise<{ leadId: string | null; error: string | null }> {
  const [sourceId, stageId] = await Promise.all([whatsappSourceId(), firstLeadStageId()]);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  // No dedicated company/establishment column to write to — folded into
  // notes instead so it isn't lost.
  const notes = input.companyName ? `المنشأة: ${input.companyName}\n${input.notes}` : input.notes;
  const { error } = await supabaseAdmin.from("leads").insert({
    id,
    full_name: input.fullName,
    normalized_phone: input.waFrom,
    primary_source_id: sourceId,
    stage_id: stageId,
    owner_id: null,
    notes,
    created_at: now,
    updated_at: now,
  });
  if (error) {
    console.error("[whatsapp crm] createLeadFromWhatsApp failed", error);
    return { leadId: null, error: "تعذر إنشاء العميل المحتمل" };
  }
  return { leadId: id, error: null };
}

/** Logs an activity on a lead, tagged so it's obviously agent-authored when
 *  a rep reviews the timeline later. */
export async function logWhatsAppActivity(leadId: string, body: string): Promise<{ error: string | null }> {
  const { error } = await supabaseAdmin.from("activities").insert({
    id: crypto.randomUUID(),
    entity_type: "lead",
    entity_id: leadId,
    body,
    direction: "inbound",
    occurred_at: new Date().toISOString(),
    user_id: null,
  });
  if (error) {
    console.error("[whatsapp crm] logWhatsAppActivity failed", error);
    return { error: "تعذر تسجيل الملاحظة" };
  }
  return { error: null };
}
