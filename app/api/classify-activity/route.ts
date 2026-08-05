import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { classifyActivity } from "@/lib/classifyActivity";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit } from "@/lib/rateLimit";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fire-and-forget classification endpoint called from LogActivitySlideOver
 * after an inbound activity is inserted. Keeps OPENROUTER_API_KEY server-side —
 * classifyActivity() must never run in client code.
 */
export async function POST(req: NextRequest) {
  const caller = await requireUser(req);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = checkRateLimit(`${caller.id}:classify-activity`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit", message: "طلبات كثيرة جداً — حاول بعد شوي." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { activityId?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const activityId = body.activityId;
  const messageText = body.body;
  if (!activityId || typeof activityId !== "string" || !messageText || typeof messageText !== "string") {
    return NextResponse.json({ error: "activityId and body are required" }, { status: 400 });
  }

  const tag = await classifyActivity(messageText);
  if (!tag) {
    // classifyActivity() already logged the underlying reason. Leave
    // situational_tag null — it stays eligible for a future backfill retry.
    return NextResponse.json({ activityId, tag: null });
  }

  const { error } = await supabase
    .from("activities")
    .update({ situational_tag: tag, tag_computed_at: new Date().toISOString() })
    .eq("id", activityId);

  if (error) {
    console.error("[classify-activity] update failed", error);
    return NextResponse.json({ activityId, tag: null, error: "update failed" }, { status: 500 });
  }

  return NextResponse.json({ activityId, tag });
}
