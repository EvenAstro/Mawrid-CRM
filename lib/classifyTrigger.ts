import { supabase } from "@/lib/supabase";

/**
 * Fires classification for a freshly-logged inbound activity.
 *
 * This existed inline in one form and nowhere else, which meant an inbound
 * reply logged from the lead panel was never classified — and the situational
 * tag is what the investigation report's turning-point detector, the
 * next-best-action matcher and the deal health score all read. Tag coverage
 * sat at ~4% partly for this reason: the backfill repairs history, but a leak
 * at the point of entry refills the gap.
 *
 * Fire-and-forget by design. The caller closes its form immediately; a tag
 * that arrives two seconds later is worth nothing to the user standing there,
 * and a classification failure must never block recording what happened.
 */
export function triggerClassification(activityId: string, body: string, direction: string): void {
  if (direction !== "inbound") return;
  const text = body.trim();
  if (!text) return;

  supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      void fetch("/api/classify-activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ activityId, body: text }),
      }).catch((err) => console.error("[classify] trigger failed", err));
    })
    .catch((err) => console.error("[classify] session lookup failed", err));
}
