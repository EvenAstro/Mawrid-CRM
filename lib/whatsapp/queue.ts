import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * The WhatsApp inbound queue — the seam between "Meta delivered a message"
 * and "the agent replied to it". The webhook enqueues and returns 200
 * immediately; a background task (or the cron sweeper for anything the
 * background task dropped) drains the queue and does the actual work.
 *
 * Every row that leaves the queue leaves through claim(), which sets
 * status to 'processing' atomically so two workers can't answer the same
 * message. The final resolveDone/resolveFailed marks the row terminal.
 */

export interface QueuedMessage {
  id: string;
  wa_from: string;
  wa_message_id: string | null;
  body: string;
  attempts: number;
}

/** Attempts before a message is parked as failed. Small — real Meta
 *  redeliveries land as new queue rows with different wa_message_ids, so
 *  attempts here only cover our own transient failures (OpenRouter blip,
 *  brief DB outage). Three tries is enough not to give up on the first
 *  hiccup and few enough that a genuinely broken message doesn't loop. */
const MAX_ATTEMPTS = 3;

/** How long a claim is considered live. A worker that crashed mid-turn
 *  leaves a row stuck in 'processing'; after this timeout the sweeper
 *  treats it as pending again. Long enough to cover the model loop's
 *  worst case, short enough that a real failure doesn't sit blocked. */
const STALE_CLAIM_MS = 90_000;

export async function enqueueInbound(input: {
  waFrom: string;
  body: string;
  waMessageId: string | null;
}): Promise<{ id: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("_whatsapp_agent_queue")
    .insert({
      wa_from: input.waFrom,
      body: input.body,
      wa_message_id: input.waMessageId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[whatsapp queue] enqueue failed", error);
    return { id: null };
  }
  return { id: data.id };
}

/**
 * Atomically hands one queued row to this worker. Returns null when the
 * queue is empty or every eligible row was already claimed by someone
 * else. Same call the after() task and the cron sweeper use — the only
 * difference between them is who kicked them off.
 */
export async function claimNext(): Promise<QueuedMessage | null> {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  // Pending, or processing but stuck long enough that the previous claim
  // is presumed dead — same predicate as the picker index.
  const { data: candidate, error: pickErr } = await supabaseAdmin
    .from("_whatsapp_agent_queue")
    .select("id, wa_from, wa_message_id, body, attempts, status, claimed_at")
    .in("status", ["pending", "processing"])
    .or(`status.eq.pending,and(status.eq.processing,claimed_at.lt.${staleBefore})`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pickErr) {
    console.error("[whatsapp queue] pick failed", pickErr);
    return null;
  }
  if (!candidate) return null;

  // Compare-and-swap on status/claimed_at: whoever's update takes wins
  // the claim, the losers get zero rows back and skip this pass.
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("_whatsapp_agent_queue")
    .update({
      status: "processing",
      claimed_at: new Date().toISOString(),
      attempts: (candidate.attempts ?? 0) + 1,
    })
    .eq("id", candidate.id)
    .eq("status", candidate.status)
    .select("id, wa_from, wa_message_id, body, attempts")
    .maybeSingle();
  if (claimErr) {
    console.error("[whatsapp queue] claim failed", claimErr);
    return null;
  }
  return (claimed as QueuedMessage) ?? null;
}

/**
 * Marks a row terminally failed with the reason, without consuming a
 * retry. Used when the agent answered with the holding message: the
 * customer has been told something, so this must not be retried, but the
 * reason has to survive somewhere a human can read it — the failure
 * happens inside a background task whose logs are awkward to reach, and
 * "why did it fall back?" is the question that actually needs answering.
 */
export async function parkFailed(id: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("_whatsapp_agent_queue")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
      last_error: reason.slice(0, 500),
    })
    .eq("id", id);
  if (error) console.error("[whatsapp queue] park failed", error);
}

export async function resolveDone(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("_whatsapp_agent_queue")
    .update({ status: "done", processed_at: new Date().toISOString(), last_error: null })
    .eq("id", id);
  if (error) console.error("[whatsapp queue] mark done failed", error);
}

/**
 * Marks a claim failed. Returns it to pending — for another sweep — until
 * the attempt count is spent, at which point it parks as 'failed' so it
 * doesn't loop forever burning credits on a message no one can answer.
 */
export async function resolveFailed(id: string, attempts: number, err: string): Promise<void> {
  const parked = attempts >= MAX_ATTEMPTS;
  const { error } = await supabaseAdmin
    .from("_whatsapp_agent_queue")
    .update({
      status: parked ? "failed" : "pending",
      claimed_at: null,
      last_error: err.slice(0, 500),
      processed_at: parked ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) console.error("[whatsapp queue] mark failed failed", error);
}
