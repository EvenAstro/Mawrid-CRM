import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { discoverFreeModels } from "@/lib/whatsapp/agent";
import { callGemini, discoverGeminiModels } from "@/lib/whatsapp/gemini";
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
 * Two ways in, because the two callers are different. A signed-in user
 * hitting the button on the WhatsApp page authenticates the same way
 * every other browser-called route here does; a script or a scheduled
 * check uses CRON_SECRET. Either is enough — but one of them is
 * required, since this spends OpenRouter quota and reports account state.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  const bySecret = !!secret && header === `Bearer ${secret}`;
  const byUser = bySecret ? null : await requireUser(req);
  if (!bySecret && !byUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  // Gemini is the primary provider now, so it's the first thing anyone
  // debugging a silent agent needs to see.
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiProbes: unknown[] = [];
  if (geminiKey) {
    for (const model of await discoverGeminiModels(geminiKey)) {
      const started = Date.now();
      const out = await callGemini({
        apiKey: geminiKey,
        model,
        messages: [{ role: "user", content: "رد بكلمة وحدة: تمام" }],
        tools: undefined,
        maxTokens: 20,
        timeoutMs: 15_000,
      });
      geminiProbes.push(
        out.ok
          ? { model, ok: true, ms: Date.now() - started, reply: out.result.content }
          : { model, ok: false, ms: Date.now() - started, status: out.status, error: out.error },
      );
    }
  }

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

  // The probes above ask for 20 tokens, which a nearly-empty balance can
  // still afford — that's why the paid floor looked healthy while the
  // agent kept failing. This asks for what the agent actually asks for,
  // so the 402 (and the budget OpenRouter will accept) is visible.
  let realistic: unknown = null;
  if (apiKey) {
    const started = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct",
          max_tokens: 450,
          temperature: 0.3,
          messages: [{ role: "user", content: "رد بجملة قصيرة: كيف حالك؟" }],
        }),
      });
      const body = await res.text();
      realistic = {
        note: "paid floor at the agent's real max_tokens (450)",
        status: res.status,
        ms: Date.now() - started,
        ok: res.ok,
        body: body.slice(0, 400),
      };
    } catch (err) {
      realistic = { note: "paid floor at 450", ok: false, error: String(err).slice(0, 200) };
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
      gemini_key: !!geminiKey,
      openrouter_key: !!apiKey,
      whatsapp_token: !!process.env.WHATSAPP_ACCESS_TOKEN,
      whatsapp_phone_id: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    },
    agent_enabled: settings?.enabled ?? null,
    gemini_probes: geminiProbes,
    discovered_count: discovered.length,
    discovered,
    probes,
    realistic_probe: realistic,
    recent_queue: queue ?? [],
  });
}
