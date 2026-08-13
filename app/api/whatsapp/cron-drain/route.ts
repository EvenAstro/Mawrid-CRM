import { NextRequest, NextResponse } from "next/server";
import { drainWhatsAppQueue } from "@/lib/whatsapp/processor";

/**
 * Cron sweeper for the WhatsApp inbound queue.
 *
 * The webhook already fires the processor via after() the moment a
 * message lands, so on a healthy platform this route is idle work — the
 * after() task drained the row before the cron even ticked. It exists for
 * the exceptions: the container recycled mid-turn, the after() task
 * crashed, the OpenRouter call took long enough for the function's wall
 * clock to expire. Anything stuck in 'processing' longer than the claim
 * TTL becomes eligible again here, and anything pending nobody ever
 * picked up gets picked up.
 *
 * Guarded by CRON_SECRET so a public poller can't drive OpenRouter usage
 * for us. Vercel Cron sends the header automatically for scheduled runs.
 *
 * Scheduled daily, not per-minute, because this project is on Vercel's
 * Hobby plan — Hobby caps crons at one run per day, and a per-minute
 * schedule in vercel.json is rejected outright, which blocks the whole
 * deployment rather than just the cron. A daily sweep is too slow to be
 * a real recovery path for a stuck message; treat it as a backstop that
 * eventually clears the queue, and rely on after() for actual delivery.
 * On a Pro plan this can go back to "* * * * *" and becomes a genuine
 * minute-level safety net.
 *
 * The route also works on demand: hit it with the CRON_SECRET bearer
 * token to force a drain if a message is visibly stuck.
 */

export const dynamic = "force-dynamic";
/** Same reason as the webhook: draining a backlog means a full model turn
 *  per message, and the default ceiling cuts that off mid-turn. */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (secret && header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await drainWhatsAppQueue(20);
  return NextResponse.json({ ok: true, ...result });
}
