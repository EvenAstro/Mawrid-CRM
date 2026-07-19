/**
 * One-time batch job: classify existing inbound activities with situational_tag.
 *
 * Scope: activities where direction = 'inbound' AND body is non-empty AND
 * situational_tag IS NULL — so it's safe to re-run (already-tagged and
 * previously-failed-but-later-fixed rows are picked up automatically, tagged
 * rows are skipped).
 *
 * Run with: npm run tag:backfill
 */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { classifyActivity, type SituationalTag } from "../lib/classifyActivity";

interface ActivityRow {
  id: string;
  body: string;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase
    .from("activities")
    .select("id, body")
    .eq("direction", "inbound")
    .not("body", "is", null)
    .neq("body", "")
    .is("situational_tag", null);

  if (error) {
    console.error("Failed to fetch inbound activities:", error);
    process.exit(1);
  }

  const activities = (data ?? []) as ActivityRow[];
  const total = activities.length;
  console.log(`Found ${total} inbound activities to classify.\n`);

  const counts: Record<SituationalTag, number> = {
    price_objection: 0,
    technical_concern: 0,
    positive_interest: 0,
    awaiting_third_party: 0,
    awaiting_external_event: 0,
    busy_reschedule: 0,
    soft_decline: 0,
    comparing_options: 0,
    requesting_callback: 0,
    acknowledgment_only: 0,
    complaint: 0,
    other: 0,
  };
  let classified = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2100)); // stay under Groq free-tier 30 req/min

    const activity = activities[i];
    const tag = await classifyActivity(activity.body);

    if (tag == null) {
      failed++;
      console.log(`Processed ${i + 1}/${total} — id=${activity.id} — FAILED (left null for retry)`);
      continue;
    }

    const { error: updateError } = await supabase
      .from("activities")
      .update({ situational_tag: tag, tag_computed_at: new Date().toISOString() })
      .eq("id", activity.id);

    if (updateError) {
      failed++;
      console.error(`Processed ${i + 1}/${total} — id=${activity.id} — update failed:`, updateError);
      continue;
    }

    classified++;
    counts[tag]++;
    console.log(`Processed ${i + 1}/${total} — id=${activity.id} — ${tag}`);
  }

  console.log("\n=== Summary ===");
  console.log(`Total inbound activities considered: ${total}`);
  console.log(`Classified: ${classified}`);
  console.log(`Failed / skipped: ${failed}`);
  console.log("\nCounts per category:");
  for (const [tag, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  ${tag}: ${count}`);
  }
}

main();
