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
}): Promise<void> {
  const { error } = await supabaseAdmin.from("_whatsapp_agent_log").insert({
    wa_from: input.waFrom,
    direction: input.direction,
    body: input.body,
    wa_message_id: input.waMessageId ?? null,
  });
  if (error) console.error("[whatsapp] log insert failed", error);
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
