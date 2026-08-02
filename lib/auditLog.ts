import { supabase } from "@/lib/supabase";

/**
 * Writes a system-generated activity row (is_system=true, activity_type_id=null)
 * so field edits / task lifecycle events show up in the lead's activity feed
 * alongside manually logged calls/messages.
 */
export async function logAudit(leadId: string | number, userId: string | null, message: string) {
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
    console.error("[logAudit] insert failed, retrying without is_system", error);
    const { is_system: _, ...fallback } = row;
    await supabase.from("activities").insert(fallback);
  }
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "الاسم",
  phone: "الجوال",
  email: "الإيميل",
  notes: "الملاحظات",
  owner: "المسؤول",
  stage: "المرحلة",
  source: "المصدر",
};

/** Builds a human-readable Arabic audit message for a set of changed lead fields. */
export function fieldChangeMessage(changes: { field: string; oldValue: string | null; newValue: string | null }[]): string {
  const parts = changes.map(({ field, oldValue, newValue }) => {
    const label = FIELD_LABELS[field] || field;
    const from = oldValue?.trim() || "—";
    const to = newValue?.trim() || "—";
    return `${label}: «${from}» ← «${to}»`;
  });
  return `✏️ تم تعديل بيانات العميل\n${parts.join("\n")}`;
}
