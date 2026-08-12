import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import { getContext, getDealMeta, type MatchTier } from "@/lib/nextBestAction/getContext";
import { buildPrompt } from "@/lib/nextBestAction/buildPrompt";
import { requireUser } from "@/lib/auth/requireUser";
<<<<<<< HEAD
=======
import { checkRateLimit } from "@/lib/rateLimit";
import { fetchCachedRecommendation, upsertRecommendationCache } from "@/lib/models/nextBestActionCache";
>>>>>>> main

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface Recommendation {
  action: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  matchTier: MatchTier;
  /** Stage the deal was in when this recommendation was generated — used to invalidate the cache on stage change. */
  stageId?: string | null;
}

interface GroqChatResponse {
  choices?: { message?: { content?: string | null } }[];
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function isValidModelOutput(v: unknown): v is Omit<Recommendation, "matchTier"> {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.action === "string" &&
    typeof r.reason === "string" &&
    (r.urgency === "high" || r.urgency === "medium" || r.urgency === "low") &&
    (r.confidence === "high" || r.confidence === "medium" || r.confidence === "low")
  );
}

export async function POST(req: NextRequest) {
<<<<<<< HEAD
  if (!(await requireUser(req))) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
=======
  const caller = await requireUser(req);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = checkRateLimit(`${caller.id}:next-best-action`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit", message: "طلبات كثيرة جداً — حاول بعد شوي." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
>>>>>>> main

  let body: { dealId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dealId = body.dealId;
  if (!dealId || typeof dealId !== "string") {
    return NextResponse.json({ error: "dealId is required" }, { status: 400 });
  }

  const force = req.nextUrl.searchParams.get("force") === "true";

  const { activityCount: currentCount, stageId: currentStageId } = await getDealMeta(dealId);
  if (currentCount === 0) {
    // Nothing to reason about yet — don't spend a model call on an empty timeline.
    return NextResponse.json({
      dealId,
      recommendation: null,
      activityCount: 0,
      matchTier: "none",
      generatedAt: null,
      cached: false,
    });
  }

  if (!force) {
    const cached = await fetchCachedRecommendation(supabase, dealId);

    if (cached) {
      const rec = cached.recommendation as Recommendation;
      const age = Date.now() - new Date(cached.generated_at).getTime();
      const stageUnchanged = (rec.stageId ?? null) === currentStageId;
      // Cache is valid only if fresh, same activity count, AND same stage.
      if (age < CACHE_TTL_MS && cached.activity_count_at_generation === currentCount && stageUnchanged) {
        return NextResponse.json({
          dealId,
          recommendation: rec,
          activityCount: currentCount,
          generatedAt: cached.generated_at,
          matchTier: rec.matchTier,
          cached: true,
        });
      }
    }
  }

  const context = await getContext(dealId);
  if (!context) {
    return NextResponse.json({ error: `Deal ${dealId} not found` }, { status: 404 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 500 });
  }

  const { system, user } = buildPrompt(context);

  let content: string | undefined;
  try {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.3,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[next-best-action] OpenRouter API error", res.status, await res.text());
      return NextResponse.json({ error: "Recommendation model request failed" }, { status: 502 });
    }

    const data = (await res.json()) as GroqChatResponse;
    content = data.choices?.[0]?.message?.content ?? undefined;
  } catch (err) {
    console.error("[next-best-action] OpenRouter call failed", err);
    return NextResponse.json({ error: "Recommendation model request failed" }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: "Empty response from recommendation model" }, { status: 502 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(content));
  } catch {
    console.error("[next-best-action] model did not return valid JSON:", content);
    return NextResponse.json({ error: "Recommendation model did not return valid JSON" }, { status: 502 });
  }

  if (!isValidModelOutput(parsed)) {
    console.error("[next-best-action] model JSON missing required fields:", parsed);
    return NextResponse.json({ error: "Recommendation model returned an unexpected shape" }, { status: 502 });
  }

  const recommendation: Recommendation = { ...parsed, matchTier: context.matchTier, stageId: context.stageId };
  const generatedAt = new Date().toISOString();

  const { error: upsertError } = await upsertRecommendationCache(supabase, dealId, recommendation, generatedAt, context.activityCount);
  if (upsertError) {
    // Non-fatal: recommendation is still valid, it just won't be cached this
    // time (e.g. the RLS policy from Step 1 hasn't been applied yet).
    console.error("[next-best-action] cache upsert failed (recommendation still returned)", upsertError);
  }

  return NextResponse.json({
    dealId,
    recommendation,
    activityCount: context.activityCount,
    generatedAt,
    matchTier: context.matchTier,
    cached: false,
  });
}
