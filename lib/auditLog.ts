import { insertSystemActivity } from "@/lib/models/activities";

/**
 * Writes a system-generated activity row so field edits / task lifecycle
 * events show up in the lead's activity feed alongside manually logged
 * calls/messages.
 */
export async function logAudit(leadId: string | number, userId: string | null, message: string) {
  await insertSystemActivity(leadId, userId, message);
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
