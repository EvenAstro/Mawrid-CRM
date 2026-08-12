/**
 * One-time batch job: classify existing inbound activities with situational_tag.
 *
 * Scope: activities where direction = 'inbound' AND body is non-empty AND
 * situational_tag IS NULL — so it's safe to re-run (already-tagged and
 * previously-failed-but-later-fixed rows are picked up automatically, tagged
 * rows are skipped).
 *
 * Run with:  npm run tag:backfill -- --limit 50
 *
 * Always trial-run with --limit before the full pass. Every row costs a model
 * call, and the point of the trial is to read the tags it assigned before
 * paying for the rest.
 *
 * Key choice matters here. This script runs with no auth session, so
 * auth.uid() is null and the anon key is subject to whatever RLS says about
 * an anonymous caller — see lib/supabaseAdmin.ts, which exists because that
 * combination is already known to return nothing on other tables. With the
 * anon key a blocked SELECT looks identical to "nothing to do": zero rows,
 * exit 0. The service-role key removes the ambiguity, and this is a one-time
 * maintenance job run by hand, which is the case service-role is for.
 */
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { classifyActivity, type SituationalTag } from "../lib/classifyActivity";

interface ActivityRow {
  id: string;
  body: string;
}

/** `--limit N` → classify at most N rows this run. Absent = every candidate. */
function parseLimit(): number | null {
  const i = process.argv.indexOf("--limit");
  if (i === -1) return null;
  const n = Number(process.argv[i + 1]);
  if (!Number.isInteger(n) || n <= 0) {
    console.error("--limit needs a positive integer, e.g. --limit 50");
    process.exit(1);
  }
  return n;
}

/**
 * Picks a trial batch spread across message lengths instead of taking the
 * newest N.
 *
 * Newest-N is a biased sample: whatever the team happened to log last week.
 * The interesting failures are at the short end — "تمام"، "ok"، "ابشر" — where
 * there is almost no signal and the classifier has to choose between
 * acknowledgment_only and a real category. Those one-liners are also most of
 * what a rep actually types, so a trial that only shows well-written
 * paragraphs will read as higher quality than the full run turns out to be.
 *
 * Thirds: shortest, longest, and a spread through the middle.
 */
function stratify(rows: ActivityRow[], n: number): ActivityRow[] {
  if (rows.length <= n) return rows;
  const byLength = [...rows].sort((a, b) => a.body.length - b.body.length);
  const third = Math.floor(n / 3);
  const shortest = byLength.slice(0, third);
  const longest = byLength.slice(-third);
  const middlePool = byLength.slice(third, byLength.length - third);
  const need = n - shortest.length - longest.length;
  const step = Math.max(1, Math.floor(middlePool.length / Math.max(1, need)));
  const middle: ActivityRow[] = [];
  for (let i = 0; i < middlePool.length && middle.length < need; i += step) {
    middle.push(middlePool[i]);
  }
  return [...shortest, ...middle, ...longest];
}

async function main() {
  const limit = parseLimit();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.warn(
      "⚠️  SUPABASE_SERVICE_ROLE_KEY is not set — falling back to the anon key.\n" +
        "   If RLS blocks anonymous reads on activities this will report 0 rows\n" +
        "   and exit successfully, which is indistinguishable from being done.\n",
    );
  }
  const supabase = createClient(SUPABASE_URL, serviceKey || SUPABASE_ANON_KEY);

  // On a trial run, over-fetch so the batch can be chosen rather than just
  // truncated — see stratify() below.
  let query = supabase
    .from("activities")
    .select("id, body")
    .eq("direction", "inbound")
    .not("body", "is", null)
    .neq("body", "")
    .is("situational_tag", null)
    .order("occurred_at", { ascending: false });
  if (limit) query = query.limit(limit * 4);

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch inbound activities:", error);
    process.exit(1);
  }

  const candidates = (data ?? []) as ActivityRow[];
  const activities = limit ? stratify(candidates, limit) : candidates;
  const total = activities.length;

  if (total === 0) {
    console.log(
      "Found 0 candidates.\n" +
        "Either the backfill is genuinely complete, or the key in use cannot see\n" +
        "these rows. Confirm with supabase/checks/backfill_readiness.sql before\n" +
        "concluding it's done — the two look the same from here.",
    );
    return;
  }
  console.log(`Found ${total} inbound activities to classify${limit ? ` (--limit ${limit})` : ""}.\n`);

  /** Every body + assigned tag, so the run can end with a reviewable sample
   * spanning short and long messages. Reading these is the whole point of a
   * trial run — the counts can look reasonable while the tags are wrong. */
  const decisions: { body: string; tag: SituationalTag }[] = [];

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
    if (i > 0) await new Promise((r) => setTimeout(r, 2100)); // ~28 req/min, under the provider's rate limit

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
    decisions.push({ body: activity.body, tag });
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

  if (decisions.length) {
    // Print across the length range, not the first 15 — the batch is ordered
    // shortest-first, so a head slice would be all one-liners.
    const sorted = [...decisions].sort((a, b) => a.body.length - b.body.length);
    const step = Math.max(1, Math.floor(sorted.length / 15));
    const shown = sorted.filter((_, i) => i % step === 0).slice(0, 15);
    console.log("\n=== Sample — read these before running the rest ===");
    console.log("(ordered shortest to longest; the short ones are where it breaks)");
    for (const s of shown) {
      const oneLine = s.body.replace(/\s+/g, " ").trim();
      const text = oneLine.length > 120 ? `${oneLine.slice(0, 120)}…` : oneLine;
      console.log(`\n  [${s.tag}]\n  ${text}`);
    }
    console.log(
      "\nIf a tag looks wrong, stop. The classifier prompt is in" +
        " lib/classifyActivity.ts\nand is cheaper to fix now than to re-run over every row.",
    );
  }
}

main();
