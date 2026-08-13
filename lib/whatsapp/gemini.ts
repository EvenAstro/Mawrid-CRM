import type { toolsFor } from "@/lib/whatsapp/crmTools";

/**
 * Google Gemini as the agent's primary provider.
 *
 * OpenRouter's free tier allows 50 requests a day on an account with no
 * credits, and a single WhatsApp turn spends three to five of them — so
 * the agent ran dry after roughly ten conversations and spent the rest of
 * the day apologising. Gemini's free tier is orders of magnitude larger
 * and needs no card, which is the actual constraint that was breaking
 * this product.
 *
 * Kept as its own module rather than folded into agent.ts because the
 * wire format is genuinely different from OpenAI's: system instructions
 * are a separate field, roles are "user"/"model" rather than
 * "user"/"assistant", tool results come back as functionResponse parts,
 * and tool schemas can't carry the JSON Schema keywords OpenAI accepts.
 * Translating at the boundary keeps the rest of the agent written against
 * one shape.
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Free-tier models, best first. 2.0-flash handles Arabic and tool
 *  calling well; the lite variant is the fallback when the first is
 *  rate-limited, since its quota is counted separately. */
export const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];

export interface GeminiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

/**
 * Strips the JSON Schema keywords Gemini rejects. The tool definitions are
 * written for OpenAI, which tolerates a superset — passing them through
 * unchanged makes Gemini 400 the whole request rather than ignore the
 * extra keys.
 */
function cleanSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(cleanSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "additionalProperties" || k === "$schema" || k === "default") continue;
    out[k] = cleanSchema(v);
  }
  return out;
}

/** Maps the agent's OpenAI-shaped messages onto Gemini's contents array.
 *  Tool results have to be attached to the call they answer, which is why
 *  the pending-call name is tracked across the loop. */
function toGeminiContents(messages: GeminiMessage[]): { contents: unknown[]; systemInstruction?: unknown } {
  const contents: unknown[] = [];
  let systemInstruction: unknown;
  // Gemini identifies a functionResponse by name, not by an id, so the
  // name of the call being answered has to be carried forward.
  const pendingCallNames: string[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      // Repeated system turns (the salvage retry adds one) are merged —
      // Gemini takes a single systemInstruction.
      const prev = (systemInstruction as { parts?: { text: string }[] } | undefined)?.parts?.[0]?.text;
      systemInstruction = { parts: [{ text: prev ? `${prev}\n\n${m.content}` : m.content }] };
      continue;
    }

    if (m.role === "tool") {
      const name = pendingCallNames.shift() ?? "tool";
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(m.content);
      } catch {
        parsed = { result: m.content };
      }
      contents.push({ role: "user", parts: [{ functionResponse: { name, response: parsed } }] });
      continue;
    }

    if (m.role === "assistant" && m.tool_calls?.length) {
      const parts: GeminiPart[] = m.tool_calls.map((c) => {
        pendingCallNames.push(c.function.name);
        let args: Record<string, unknown> = {};
        try {
          args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
        } catch {
          args = {};
        }
        return { functionCall: { name: c.function.name, args } };
      });
      if (m.content?.trim()) parts.unshift({ text: m.content });
      contents.push({ role: "model", parts });
      continue;
    }

    if (!m.content?.trim()) continue;
    contents.push({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });
  }

  return { contents, systemInstruction };
}

export interface GeminiResult {
  content?: string;
  tool_calls?: GeminiMessage["tool_calls"];
}

/**
 * One Gemini call, returning the agent's own message shape so callers
 * don't have to know which provider answered.
 */
export async function callGemini(input: {
  apiKey: string;
  model: string;
  messages: GeminiMessage[];
  tools: ReturnType<typeof toolsFor> | undefined;
  maxTokens: number;
  timeoutMs: number;
}): Promise<{ ok: true; result: GeminiResult } | { ok: false; status: number; error: string }> {
  const { contents, systemInstruction } = toGeminiContents(input.messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      // Same reasoning as the OpenRouter path: low temperature keeps a
      // model writing Arabic on-distribution.
      temperature: 0.3,
      maxOutputTokens: input.maxTokens,
    },
    // Gemini blocks a lot by default, and a sales conversation has no
    // business tripping a safety filter — a block here reads to the
    // customer as the agent going silent.
    safetySettings: [
      "HARM_CATEGORY_HARASSMENT",
      "HARM_CATEGORY_HATE_SPEECH",
      "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      "HARM_CATEGORY_DANGEROUS_CONTENT",
    ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
  };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (input.tools?.length) {
    body.tools = [
      {
        functionDeclarations: input.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: cleanSchema(t.function.parameters),
        })),
      },
    ];
  }

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}/${input.model}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(input.timeoutMs),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }

    const data = await res.json();
    const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    const calls = parts.filter((p) => p.functionCall);

    return {
      ok: true,
      result: {
        content: text || undefined,
        tool_calls: calls.length
          ? calls.map((p, i) => ({
              // Gemini has no call ids; the agent only uses these to pair
              // a result back to its call, so a positional one is enough.
              id: `gemini-${i}-${p.functionCall!.name}`,
              type: "function" as const,
              function: {
                name: p.functionCall!.name,
                arguments: JSON.stringify(p.functionCall!.args ?? {}),
              },
            }))
          : undefined,
      },
    };
  } catch (err) {
    return { ok: false, status: 0, error: String(err).slice(0, 200) };
  }
}
