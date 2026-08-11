import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateParsed, type ParsedNote } from "@/lib/parseNote/schema";
import { SITUATIONAL_TAGS } from "@/lib/classifyActivity";

/**
 * Proposal 64 — paste a conversation, get back a reviewable set of changes.
 *
 * This route never writes to the database. It returns a proposal; the
 * client's review card is what writes, and only for rows the rep left
 * checked. Nothing here is applied on the model's authority — see
 * lib/parseNote/schema.ts for why, and for the quote-grounding check that
 * runs on the response before it is trusted at all.
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.3-70b-instruct";
const MAX_INPUT = 4000;

function buildPrompt(text: string): string {
  return `اقرأ محادثة العميل التالية واستخرج منها JSON فقط، بدون أي نص خارج الـJSON.

النص:
"""
${text}
"""

أعد بالضبط هذا الشكل:
{
  "activity": {
    "direction": "inbound" أو "outbound",
    "body": "ملخص قصير لما قاله العميل أو ما قلناه، بالعربي",
    "tag": واحدة من [${SITUATIONAL_TAGS.join(", ")}] أو null إن لم تنطبق أي فئة,
    "quote": "الجملة الحرفية من النص أعلاه التي استندت إليها — يجب أن تكون منسوخة حرفياً من النص، لا معاد صياغتها"
  },
  "task": {
    "title": "عنوان مهمة متابعة قصير، أو null إن لم يوجد التزام بموعد واضح",
    "inDays": عدد صحيح من 0 إلى 90 يمثل عدد الأيام من اليوم حتى الموعد المذكور,
    "quote": "الجملة الحرفية من النص التي تذكر الموعد"
  }
}

قواعد صارمة:
- "quote" يجب أن تكون نسخاً حرفياً من النص أعلاه، حرفاً بحرف. لا تُعِد صياغتها ولا تلخّصها.
- إن لم يوجد التزام بموعد صريح أو ضمني، اجعل "task": null بالكامل.
- إن لم يوجد أي محتوى قابل للتصنيف، اجعل "activity": null بالكامل.
- لا تخترع معلومات غير موجودة في النص. لا تُخرج أي نص خارج الـJSON.`;
}

function stripFences(text: string): string {
  return text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
}

export async function POST(req: NextRequest) {
  const caller = await requireUser(req);
  if (!caller) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = checkRateLimit(`${caller.id}:parse-note`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limit", message: "طلبات كثيرة جداً — حاول بعد شوي." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  // Truncate rather than reject — a rep pasting a long thread should still
  // get something back for the part that fits, not a hard failure.
  const input = text.slice(0, MAX_INPUT);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "config", message: "مفتاح OPENROUTER_API_KEY غير مُعرّف." },
      { status: 500 },
    );
  }

  let raw: unknown;
  try {
    // A hung upstream call must not leave the rep staring at "جارٍ القراءة…"
    // with no way out — 12s is generous for this model and short enough that
    // the empty-state fallback below is reached while someone is still
    // watching the screen.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 500,
        messages: [{ role: "user", content: buildPrompt(input) }],
      }),
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) {
      if (res.status === 429) {
        return NextResponse.json(
          { error: "upstream_rate_limit", message: "النموذج مشغول — حاول بعد شوي." },
          { status: 429, headers: { "Retry-After": "5" } },
        );
      }
      throw new Error(`OpenRouter ${res.status}`);
    }
    const data = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    raw = JSON.parse(stripFences(content));
  } catch (err) {
    console.error("[parse-note] model call failed", err);
    // Fails closed — the client's empty state ("ما قدرت أستخرج شيء واضح")
    // is the correct outcome here, not a 500 the user cannot act on.
    const empty: ParsedNote = { activity: null, task: null, rejected: ["فشل الاتصال بالنموذج"] };
    return NextResponse.json(empty);
  }

  // Every field is re-checked against the pasted text itself, independent of
  // whatever the model claims. This is the actual gate — everything above it
  // is just getting a candidate to check.
  const parsed = validateParsed(raw, input);
  if (parsed.rejected.length) {
    console.warn("[parse-note] rejected fields", parsed.rejected);
  }
  return NextResponse.json(parsed);
}
