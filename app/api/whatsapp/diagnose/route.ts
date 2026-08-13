import { NextRequest, NextResponse } from "next/server";
import { discoverFreeModels } from "@/lib/whatsapp/agent";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Answers "why isn't the agent replying?" in one request.
 *
 * Diagnosing this by reading Vercel logs a screenshot at a time is slow
 * and misses the thing that actually matters most — whether the model
 * chain has anything usable in it right now. This hits every model
 * discovery returns with a trivial prompt and reports the real status per
 * model, alongside the queue's state, so a dead chain, an empty
 * discovery, and a stuck queue are all distinguishable at a glance.
 *
 * Guarded by CRON_SECRET: it spends OpenRouter quota and exposes account
 * state, so it must not be openly pollable.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured — set it before using this route" }, { status: 503 });
  }
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const discovered = await discoverFreeModels();

  // Probe each candidate with the smallest possible request. Same order
  // the agent would try them in, so the first "ok" here is the model that
  // would have answered the customer.
  const probes: unknown[] = [];
  if (apiKey) {
    for (const m of [...discovered.slice(0, 6), { id: "meta-llama/llama-3.3-70b-instruct", supportsTools: true }]) {
      const started = Date.now();
      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(15_000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: m.id,
            max_tokens: 20,
            messages: [{ role: "user", content: "قل: تمام" }],
          }),
        });
        const body = await res.text();
        probes.push({
          model: m.id,
          supports_tools: m.supportsTools,
          status: res.status,
          ms: Date.now() - started,
          ok: res.ok,
          // Only the error matters here; a success body is noise.
          error: res.ok ? undefined : body.slice(0, 200),
        });
      } catch (err) {
        probes.push({ model: m.id, supports_tools: m.supportsTools, ms: Date.now() - started, ok: false, error: String(err).slice(0, 200) });
      }
    }
  }

  const { data: queue } = await supabaseAdmin
    .from("_whatsapp_agent_queue")
    .select("status, created_at, last_error, wa_from")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: settings } = await supabaseAdmin
    .from("_whatsapp_agent_settings")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();

  return NextResponse.json({
    env: {
      openrouter_key: !!apiKey,
      whatsapp_token: !!process.env.WHATSAPP_ACCESS_TOKEN,
      whatsapp_phone_id: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    },
    agent_enabled: settings?.enabled ?? null,
    discovered_count: discovered.length,
    discovered,
    probes,
    recent_queue: queue ?? [],
  });
}
