import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { supabase } from "@/lib/supabase";

/**
 * Data access for the WhatsApp sandbox tables — the kill switch and the
 * message log. Admin client throughout: the webhook route that calls this
 * has no browser session (Meta is calling us), and the settings read needs
 * to work even for a signed-in user checking the toggle from the UI later.
 */

export async function isWhatsAppAgentEnabled(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("_whatsapp_agent_settings")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    console.error("[whatsapp] settings read failed", error);
    // Fail closed — a broken settings read must not be read as "on".
    return false;
  }
  return !!data?.enabled;
}

export async function setWhatsAppAgentEnabled(enabled: boolean): Promise<{ error: Error | null }> {
  const { error } = await supabaseAdmin
    .from("_whatsapp_agent_settings")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", true);
  return { error };
}

export async function logWhatsAppMessage(input: {
  waFrom: string;
  direction: "inbound" | "outbound";
  body: string;
  waMessageId?: string | null;
  leadId?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("_whatsapp_agent_log").insert({
    wa_from: input.waFrom,
    direction: input.direction,
    body: input.body,
    wa_message_id: input.waMessageId ?? null,
    lead_id: input.leadId ?? null,
  });
  if (error) console.error("[whatsapp] log insert failed", error);
}

/**
 * Records an inbound message and reports whether this delivery is the one
 * that should be answered.
 *
 * Meta redelivers a webhook it considers failed — including one that was
 * merely slow, which the model loop routinely is — so the same message can
 * arrive two or three times. The unique index on wa_message_id
 * (20260812180000) makes this insert an atomic claim: exactly one delivery
 * inserts, the rest come back as a unique violation and are told to stop.
 * Without it the retry generated a second, different reply, because by then
 * the first reply was already in the history the agent reads.
 *
 * A logging failure that isn't a duplicate returns true: dropping a real
 * customer message because we couldn't write a log row is the worse of the
 * two failures.
 */
export async function claimInboundMessage(input: {
  waFrom: string;
  body: string;
  waMessageId: string | null;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("_whatsapp_agent_log").insert({
    wa_from: input.waFrom,
    direction: "inbound",
    body: input.body,
    wa_message_id: input.waMessageId,
  });
  if (!error) return true;
  if (error.code === "23505") {
    console.log(`[whatsapp] duplicate delivery ${input.waMessageId} — already handled`);
    return false;
  }
  console.error("[whatsapp] inbound log insert failed", error);
  return true;
}

/** Backfills the lead this conversation resolved to onto the rows that
 *  don't have it yet, so the CRM view can show the link on the whole
 *  thread rather than only on messages sent after the match. */
export async function linkConversationToLead(waFrom: string, leadId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("_whatsapp_agent_log")
    .update({ lead_id: leadId })
    .eq("wa_from", waFrom)
    .is("lead_id", null);
  if (error) console.error("[whatsapp] lead link failed", error);
}

/** Recent turns for one number, oldest first — the agent's short memory of
 * this conversation. Capped: a sandbox test thread should never grow large
 * enough to need pagination, and capping keeps the prompt bounded. */
export async function fetchWhatsAppHistory(waFrom: string, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("_whatsapp_agent_log")
    .select("direction, body, created_at")
    .eq("wa_from", waFrom)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[whatsapp] history read failed", error);
    return [];
  }
  return ((data as { direction: string; body: string; created_at: string }[]) ?? []).reverse();
}

/** Every logged message, newest first — the review screen. */
export async function fetchWhatsAppLog(limit = 100) {
  const { data, error } = await supabaseAdmin
    .from("_whatsapp_agent_log")
    .select("id, wa_from, direction, body, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[whatsapp] log read failed", error);
    return [];
  }
  return (data as { id: string; wa_from: string; direction: string; body: string; created_at: string }[]) ?? [];
}

// ── Browser-side reads (RLS-gated, authenticated only) ──────────────────
// The two functions above use supabaseAdmin because the webhook route that
// calls them has no browser session. The admin screen below has a real
// signed-in user, so it reads through the normal client and the RLS read
// policies migration 20260812090000 added — same pattern every other
// screen in this product follows.

export async function fetchWhatsAppSettingsClient() {
  return supabase.from("_whatsapp_agent_settings").select("enabled").eq("id", true).maybeSingle();
}

export async function fetchWhatsAppLogClient(limit = 100) {
  return supabase
    .from("_whatsapp_agent_log")
    .select("id, wa_from, direction, body, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
}

export interface WhatsAppConversation {
  wa_from: string;
  message_count: number;
  inbound_count: number;
  first_at: string;
  last_at: string;
  last_body: string;
  last_direction: string;
  lead_id: string | null;
  lead_name: string | null;
  stage_label: string | null;
  owner_name: string | null;
}

/** One row per number the agent has talked to, newest first. Grouping and
 *  the CRM join happen in the RPC (20260812180000) rather than here — the
 *  alternative is pulling every message to the browser to group it, which
 *  stops being viable the moment this leaves sandbox traffic. */
export async function fetchWhatsAppConversationsClient() {
  return supabase.rpc("whatsapp_conversations");
}

/** The full thread for one number, oldest first — chat reading order. */
export async function fetchWhatsAppThreadClient(waFrom: string, limit = 500) {
  return supabase
    .from("_whatsapp_agent_log")
    .select("id, wa_from, direction, body, created_at, lead_id")
    .eq("wa_from", waFrom)
    .order("created_at", { ascending: true })
    .limit(limit);
}
