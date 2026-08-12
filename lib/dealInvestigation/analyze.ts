import { getContext } from "@/lib/nextBestAction/getContext";
import type { SituationalTag } from "@/lib/classifyActivity";
import { fetchEntityActivitiesAdmin } from "@/lib/models/activities";
import { fetchDealForInvestigation, fetchDealValuesByIds } from "@/lib/models/deals";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct";

/** Inbound tags that mark the moment a deal starts to slip away. */
export const TURNING_POINT_TAGS: SituationalTag[] = [
  "soft_decline",
  "awaiting_third_party",
  "awaiting_external_event",
  "busy_reschedule",
];

const DAY_MS = 86_400_000;

// ── Public shapes ──────────────────────────────────────────────────────────

export interface InvestigationActivity {
  id: string;
  body: string | null;
  direction: string | null;
  occurred_at: string | null;
  situational_tag: SituationalTag | null;
  activityTypeLabel: string | null;
  isTurningPoint: boolean;
}

export interface InvestigationDeal {
  id: string;
  name: string | null;
  valueSAR: number | null;
  currency: string;
  stageLabel: string;
  createdAt: string | null;
  lostAt: string | null;
  durationDays: number | null;
}

export interface TurningPointMeta {
  date: string | null;
  daysBeforeLoss: number | null;
}

export interface SimilarBreakdown {
  wonCount: number;
  lostCount: number;
  avgWinDays: number | null;
  avgLossDays: number | null;
}

export interface AiReport {
  executive_summary: string;
  turning_point: {
    date: string | null;
    description: string;
    what_should_have_happened: string;
    window_hours: number;
  };
  root_causes: {
    title: string;
    description: string;
    evidence: string;
    severity: "critical" | "major" | "minor";
  }[];
  comparison: {
    won_pattern: string;
    lost_pattern: string;
    key_differentiator: string;
  };
  lesson: {
    title: string;
    rule: string;
    applies_to: string;
  };
  cost_analysis: {
    this_deal: number;
    similar_losses_count: number;
    total_pattern_cost: number;
    currency: string;
  };
}

export interface CostAnalysis {
  this_deal: number;
  similar_losses_count: number;
  total_pattern_cost: number;
  currency: string;
}

export interface InvestigationPayload {
  deal: InvestigationDeal;
  activities: InvestigationActivity[];
  turningPoint: TurningPointMeta;
  breakdown: SimilarBreakdown;
  /** Deterministic cost figures, always present — used by the raw fallback too. */
  costAnalysis: CostAnalysis;
  report: AiReport | null;
  /** True when the AI call failed — the page shows raw data with a notice. */
  aiFailed: boolean;
}

// ── Raw DB row shapes ──────────────────────────────────────────────────────

interface RawActivityRow {
  id: string;
  body: string | null;
  direction: string | null;
  occurred_at: string | null;
  situational_tag: string | null;
  activity_types: { label: string | null } | null;
}

interface RawDealRow {
  id: string;
  name: string | null;
  lead_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  currency_code: string | null;
  created_at: string | null;
  updated_at: string | null;
  pipeline_stages: { label: string | null; terminal_type: string | null } | null;
}

function toSituationalTag(v: string | null): SituationalTag | null {
  return (v ?? null) as SituationalTag | null;
}

function dealValueSAR(expectedMinor: number | null, wonMinor: number | null): number | null {
  const minor = wonMinor ?? expectedMinor;
  return minor == null ? null : Math.round(minor / 100);
}

// ── Data fetch ─────────────────────────────────────────────────────────────

/** All activities for a deal (deal-linked + originating-lead-linked), oldest first. */
async function fetchDealActivities(dealId: string, leadId: string | null): Promise<RawActivityRow[]> {
  const rows: RawActivityRow[] = [];

  const { data: dealActs, error: e1 } = await fetchEntityActivitiesAdmin("deal", dealId);
  if (e1) console.error("[investigation] deal activities fetch failed", e1);
  if (dealActs) rows.push(...(dealActs as unknown as RawActivityRow[]));

  if (leadId) {
    const { data: leadActs, error: e2 } = await fetchEntityActivitiesAdmin("lead", leadId);
    if (e2) console.error("[investigation] lead activities fetch failed", e2);
    if (leadActs) rows.push(...(leadActs as unknown as RawActivityRow[]));
  }

  return rows.sort((a, b) => new Date(a.occurred_at ?? 0).getTime() - new Date(b.occurred_at ?? 0).getTime());
}

// ── AI prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior sales intelligence analyst producing a classified investigation report on a lost deal. Your job is to be brutally honest, specific, and actionable. You analyze what actually happened based on real data — not generic advice.

Write in Arabic. Be clinical and precise, not motivational.
Respond ONLY in valid JSON. No markdown, no code fences, no preamble.`;

function buildUserPrompt(
  deal: InvestigationDeal,
  activities: InvestigationActivity[],
  turningPointActivity: InvestigationActivity | null,
  turningPoint: TurningPointMeta,
  breakdown: SimilarBreakdown,
  wonSummaries: string[],
  lostSummaries: string[],
): string {
  const timeline = activities.length
    ? activities
        .map(
          (a) =>
            `- ${a.occurred_at ?? "unknown"} [${a.direction ?? "?"}]${
              a.situational_tag ? ` (${a.situational_tag})` : ""
            }: ${a.body ?? "(no text)"}`,
        )
        .join("\n")
    : "(no activities recorded)";

  const tp = turningPointActivity
    ? `${turningPointActivity.occurred_at ?? "unknown"} [${turningPointActivity.situational_tag ?? "?"}]: ${
        turningPointActivity.body ?? "(no text)"
      } — ${turningPoint.daysBeforeLoss ?? "?"} days before loss`
    : "(no clear turning point detected in the timeline)";

  const wonSummary = wonSummaries.length ? wonSummaries.map((s, i) => `  ${i + 1}. ${s}`).join("\n") : "  (none)";
  const lostSummary = lostSummaries.length ? lostSummaries.map((s, i) => `  ${i + 1}. ${s}`).join("\n") : "  (none)";

  return `Analyze this lost deal and produce an investigation report.

DEAL: ${deal.name ?? "Unknown"} | ${deal.valueSAR ?? "unknown"} ${deal.currency} | Lost in: ${deal.stageLabel} | Duration: ${
    deal.durationDays ?? "unknown"
  } days

ACTIVITY TIMELINE:
${timeline}

TURNING POINT:
${tp}

SIMILAR DEALS COMPARISON:
Won (${breakdown.wonCount}, avg ${breakdown.avgWinDays ?? "?"} days to win):
${wonSummary}
Lost (${breakdown.lostCount}, avg ${breakdown.avgLossDays ?? "?"} days to loss):
${lostSummary}

Produce a JSON report with exactly these fields:
{
  "executive_summary": "2-3 sentences. What happened in plain terms. Start with the outcome, then the root cause.",
  "turning_point": {
    "date": "ISO date of the turning point activity",
    "description": "What the customer said/did",
    "what_should_have_happened": "Specific action the rep should have taken within what timeframe, based on similar won deals",
    "window_hours": number
  },
  "root_causes": [
    { "title": "Short title (Arabic)", "description": "1-2 sentences with data", "evidence": "Quote or data point from the timeline that proves this", "severity": "critical" | "major" | "minor" }
  ],
  "comparison": {
    "won_pattern": "What reps did differently in won deals — specific and data-driven",
    "lost_pattern": "What pattern this deal shared with other lost deals",
    "key_differentiator": "The single most important difference between won and lost"
  },
  "lesson": {
    "title": "Short memorable title (Arabic, max 8 words)",
    "rule": "The actionable rule this teaches — specific enough to follow next time",
    "applies_to": "Which stage + situational_tag combination this rule applies to"
  },
  "cost_analysis": { "this_deal": number, "similar_losses_count": number, "total_pattern_cost": number, "currency": "SAR" }
}

Provide 2 to 4 root_causes. Respond with only the JSON object.`;
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

interface GroqChatResponse {
  choices?: { message?: { content?: string | null } }[];
}

function isReport(v: unknown): v is AiReport {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.executive_summary === "string" &&
    typeof r.turning_point === "object" &&
    r.turning_point !== null &&
    Array.isArray(r.root_causes) &&
    typeof r.comparison === "object" &&
    r.comparison !== null &&
    typeof r.lesson === "object" &&
    r.lesson !== null
  );
}

// ── Main entry ─────────────────────────────────────────────────────────────

export async function analyzeDeal(dealId: string): Promise<InvestigationPayload | null> {
  const { data: dealRaw, error: dealErr } = await fetchDealForInvestigation(dealId);

  if (dealErr || !dealRaw) {
    console.error("[investigation] deal not found", dealErr);
    return null;
  }
  const d = dealRaw as unknown as RawDealRow;

  const lostAt = d.updated_at;
  const currency = d.currency_code || "SAR";
  const durationDays =
    d.created_at && lostAt
      ? Math.max(0, Math.floor((new Date(lostAt).getTime() - new Date(d.created_at).getTime()) / DAY_MS))
      : null;

  const deal: InvestigationDeal = {
    id: d.id,
    name: d.name,
    valueSAR: dealValueSAR(d.expected_value_minor, d.won_value_minor),
    currency,
    stageLabel: d.pipeline_stages?.label ?? "غير معروف",
    createdAt: d.created_at,
    lostAt,
    durationDays,
  };

  // Activities + turning point
  const rawActs = await fetchDealActivities(dealId, d.lead_id);
  const turningRaw = rawActs.find(
    (a) => a.direction === "inbound" && a.situational_tag && TURNING_POINT_TAGS.includes(a.situational_tag as SituationalTag),
  );

  const activities: InvestigationActivity[] = rawActs.map((a) => ({
    id: a.id,
    body: a.body,
    direction: a.direction,
    occurred_at: a.occurred_at,
    situational_tag: toSituationalTag(a.situational_tag),
    activityTypeLabel: a.activity_types?.label ?? null,
    isTurningPoint: a.id === turningRaw?.id,
  }));

  const turningPointActivity = activities.find((a) => a.isTurningPoint) ?? null;
  const daysBeforeLoss =
    turningPointActivity?.occurred_at && lostAt
      ? Math.max(0, Math.floor((new Date(lostAt).getTime() - new Date(turningPointActivity.occurred_at).getTime()) / DAY_MS))
      : null;
  const turningPoint: TurningPointMeta = {
    date: turningPointActivity?.occurred_at ?? null,
    daysBeforeLoss,
  };

  // Similar deals via the proven 3-tier matcher, enriched with value + duration.
  const context = await getContext(dealId);
  const similar = context?.similarDeals ?? [];
  const similarIds = similar.map((s) => s.dealId);

  const valueById = new Map<string, { valueSAR: number | null; createdAt: string | null; resolvedAt: string | null }>();
  if (similarIds.length) {
    const { data: extraRaw } = await fetchDealValuesByIds(similarIds);
    for (const r of (extraRaw as unknown as RawDealRow[]) ?? []) {
      valueById.set(r.id, {
        valueSAR: dealValueSAR(r.expected_value_minor, r.won_value_minor),
        createdAt: r.created_at,
        resolvedAt: r.updated_at,
      });
    }
  }

  const won = similar.filter((s) => s.outcome === "won");
  const lost = similar.filter((s) => s.outcome === "lost");
  const durationOf = (id: string): number | null => {
    const v = valueById.get(id);
    if (!v?.createdAt || !v.resolvedAt) return null;
    return Math.max(0, Math.floor((new Date(v.resolvedAt).getTime() - new Date(v.createdAt).getTime()) / DAY_MS));
  };
  const avg = (nums: (number | null)[]): number | null => {
    const valid = nums.filter((n): n is number => n != null);
    return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  };

  const breakdown: SimilarBreakdown = {
    wonCount: won.length,
    lostCount: lost.length,
    avgWinDays: avg(won.map((s) => durationOf(s.dealId))),
    avgLossDays: avg(lost.map((s) => durationOf(s.dealId))),
  };

  // Deterministic cost analysis — never trust the LLM's arithmetic.
  const thisDeal = deal.valueSAR ?? 0;
  const lostValuesSum = lost.reduce((sum, s) => sum + (valueById.get(s.dealId)?.valueSAR ?? 0), 0);
  const costAnalysis: CostAnalysis = {
    this_deal: thisDeal,
    similar_losses_count: lost.length,
    total_pattern_cost: thisDeal + lostValuesSum,
    currency,
  };

  // AI call
  const apiKey = process.env.OPENROUTER_API_KEY;
  let report: AiReport | null = null;
  let aiFailed = false;

  if (!apiKey) {
    console.error("[investigation] OPENROUTER_API_KEY not set — returning raw data");
    aiFailed = true;
  } else {
    const userPrompt = buildUserPrompt(
      deal,
      activities,
      turningPointActivity,
      turningPoint,
      breakdown,
      won.map((s) => s.summary),
      lost.map((s) => s.summary),
    );
    try {
      const res = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          temperature: 0.4,
          max_tokens: 1200,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        console.error("[investigation] OpenRouter API error", res.status, await res.text());
        aiFailed = true;
      } else {
        const data = (await res.json()) as GroqChatResponse;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          aiFailed = true;
        } else {
          const parsed: unknown = JSON.parse(stripFences(content));
          if (isReport(parsed)) {
            // Override the AI's cost arithmetic with our deterministic figures.
            report = { ...parsed, cost_analysis: costAnalysis };
          } else {
            console.error("[investigation] model JSON missing required fields:", parsed);
            aiFailed = true;
          }
        }
      }
    } catch (err) {
      console.error("[investigation] Groq call failed", err);
      aiFailed = true;
    }
  }

  return { deal, activities, turningPoint, breakdown, costAnalysis, report, aiFailed };
}
