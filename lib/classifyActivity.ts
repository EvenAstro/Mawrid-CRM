/** Fixed category list for the Next Best Action tagging pipeline — do not add/remove without updating the classification prompt below. */
export const SITUATIONAL_TAGS = [
  "price_objection",
  "technical_concern",
  "positive_interest",
  "awaiting_third_party",
  "awaiting_external_event",
  "busy_reschedule",
  "soft_decline",
  "comparing_options",
  "requesting_callback",
  "acknowledgment_only",
  "complaint",
  "other",
] as const;

export type SituationalTag = (typeof SITUATIONAL_TAGS)[number];

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const CLASSIFY_MODEL = "meta-llama/llama-3.3-70b-instruct";

function buildPrompt(messageText: string): string {
  return `Classify this customer message into exactly one category:
price_objection | technical_concern | positive_interest | awaiting_third_party |
awaiting_external_event | busy_reschedule | soft_decline | comparing_options |
requesting_callback | acknowledgment_only | complaint | other

Category definitions:
- price_objection: explicit objection about price or cost
- technical_concern: technical question or issue with the system
- positive_interest: clear interest, agreement, or positive engagement (e.g. confirming a demo time)
- awaiting_third_party: waiting on another person to decide (accountant, manager, partner)
- awaiting_external_event: waiting on an external circumstance unrelated to the decision itself (collecting payment from their own customers, end of a busy season)
- busy_reschedule: currently busy, requesting to reschedule to a specific or vague later time
- soft_decline: indirect refusal or stalling with no clear reason. If the message explicitly contains words like "رد سلبي" or "رفض", classify as soft_decline with high confidence.
- comparing_options: mentions a competitor or alternative they're evaluating
- requesting_callback: explicitly asks for a call or follow-up at a specific time
- acknowledgment_only: simple reply with no real information (greeting, "ok", confirming receipt)
- complaint: expresses dissatisfaction with the service or product
- other: anything that doesn't fit above, including internal notes that aren't actually a customer reply

Message: "${messageText}"

Respond with only the category name, nothing else.`;
}

function isSituationalTag(value: string): value is SituationalTag {
  return (SITUATIONAL_TAGS as readonly string[]).includes(value);
}

interface GroqChatResponse {
  choices?: { message?: { content?: string | null } }[];
}

/**
 * Classifies a single inbound customer message into one of SITUATIONAL_TAGS using
 * OpenRouter's OpenAI-compatible chat completions API (meta-llama/llama-3.3-70b-instruct).
 * Server-side only (reads OPENROUTER_API_KEY). Returns null on any failure — including an
 * off-list model response — so callers can leave situational_tag null and retry later.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function classifyActivity(messageText: string): Promise<SituationalTag | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("[classifyActivity] OPENROUTER_API_KEY is not set");
    return null;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: CLASSIFY_MODEL,
          temperature: 0,
          max_tokens: 20,
          messages: [{ role: "user", content: buildPrompt(messageText) }],
        }),
      });

      if (res.status === 429 && attempt === 0) {
        // Free-tier rate limit — back off once and retry.
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 5) * 1000);
        continue;
      }

      if (!res.ok) {
        console.error(`[classifyActivity] OpenRouter API error ${res.status}`, await res.text());
        return null;
      }

      const data = (await res.json()) as GroqChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      const tag = content.trim().toLowerCase();
      return isSituationalTag(tag) ? tag : null;
    } catch (err) {
      console.error("[classifyActivity] classification call failed", err);
      return null;
    }
  }
  return null;
}
