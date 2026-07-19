import type { DealContext } from "./getContext";

export const SYSTEM_PROMPT = `You are a sales assistant embedded in a CRM used by an Arabic-speaking sales team in Saudi Arabia. You analyze a live customer conversation and recommend ONE clear next action for the sales rep.

Rules:
- Write "action" and "reason" in Arabic, UNLESS the conversation itself is primarily in English — then match that language.
- Be specific and concrete. Never say vague things like "follow up" without saying how and why.
- Base your reasoning on the patterns in the similar past deals provided. If the matches are weak or few (fewer than 3, or matched only loosely), say so honestly in the reason and lower your confidence accordingly — do not overstate certainty from a small sample.
- Keep "reason" to 1-2 sentences max.
- Respond ONLY with valid JSON matching the exact schema below. No markdown, no extra text, no code fences.`;

const TIER_DESCRIPTION: Record<DealContext["matchTier"], string> = {
  exact: "same stage + same customer situation",
  stage: "same stage only (situation varied)",
  tag: "same customer situation only (stage varied)",
  none: "no comparable resolved deals found",
};

function formatTimeline(context: DealContext): string {
  if (context.timeline.length === 0) return "(no activity recorded yet)";
  return context.timeline
    .map((a) => `- [${a.direction ?? "unknown"}] ${a.occurred_at ?? "unknown date"}: ${a.body ?? "(no text)"}`)
    .join("\n");
}

function formatSimilarDeals(context: DealContext): string {
  if (context.similarDeals.length === 0) {
    return "(no comparable resolved deals found — reason from general sales judgment and say so in your response)";
  }
  const header = `Match quality: ${TIER_DESCRIPTION[context.matchTier]} (${context.similarDeals.length} deal${
    context.similarDeals.length === 1 ? "" : "s"
  })`;
  const rows = context.similarDeals
    .map(
      (d, i) =>
        `${i + 1}. Outcome: ${d.outcome.toUpperCase()} | Stage: ${d.stageLabel} | Situation: ${
          d.situationalTag ?? "unknown"
        } | Summary: ${d.summary}`,
    )
    .join("\n");
  return `${header}\n${rows}`;
}

export function buildPrompt(context: DealContext): { system: string; user: string } {
  const user = `Deal Context:
- Current stage: ${context.stageLabel}
- Days in this stage: ${context.daysInStage}

Conversation Timeline:
${formatTimeline(context)}

Similar Past Deals:
${formatSimilarDeals(context)}

Respond in this exact JSON schema:
{
  "action": "string",
  "reason": "string",
  "urgency": "high" | "medium" | "low",
  "confidence": "high" | "medium" | "low"
}`;

  return { system: SYSTEM_PROMPT, user };
}
