import { MIN_SAMPLE } from "@/lib/stats";

/**
 * صحة الصفقة — proposal 70.
 *
 * A deterministic score over things that already happened to a deal. Not a
 * forecast, and it must never be described as one: proposal 69 was cut
 * precisely because a probability we cannot defend is worse than no number.
 * Nothing here is predicted. Every factor is a description of the record,
 * and the panel shows the arithmetic that produced the total.
 *
 * ── On the weights ──────────────────────────────────────────────────────
 *
 * Two of the five factors are derived from this account's own history. Three
 * are hand-set from what a sales team says matters. The difference is visible
 * in the UI on every factor, because a number presented as measured when it
 * was chosen is the same failure as a forecast presented as certainty.
 *
 * A factor is only derived when its sample clears MIN_SAMPLE — the same
 * threshold in lib/stats.ts, not a second one invented here. Below it the
 * factor falls back to its manual value and says so. The fallback is
 * announced, never silent: "not enough history to measure this yet" is a
 * useful thing for a user to know about their own data.
 */

export type FactorBasis =
  | { kind: "derived"; sampleSize: number; baseline: number }
  | { kind: "manual" };

export interface HealthFactor {
  key: "turning_point" | "silence" | "no_next_step" | "one_sided" | "age";
  label: string;
  /** What was observed, in the user's words. */
  detail: string;
  /** Always <= 0. Health starts at 100 and factors subtract. */
  contribution: number;
  basis: FactorBasis;
}

export interface DealHealth {
  dealId: string;
  score: number;
  factors: HealthFactor[];
  /** Factors that did not fire — shown greyed so the score reads as complete. */
  clear: string[];
}

/** Hand-set weights. Named, exported and overridable rather than inline
 * magic numbers, so "who decided this?" has an answer that isn't "nobody". */
export const MANUAL_WEIGHTS = {
  turningPoint: -25,
  noNextStep: -10,
  oneSided: -9,
  /** Used for silence/age only when their baselines can't be derived. */
  silenceFallback: -15,
  ageFallback: -10,
} as const;

/** Fallback baselines, in days, when history is too thin to measure. */
const FALLBACK_SILENCE_DAYS = 7;
const FALLBACK_AGE_DAYS = 60;

export const TURNING_POINT_TAGS = [
  "soft_decline",
  "awaiting_third_party",
  "awaiting_external_event",
  "busy_reschedule",
] as const;

const TAG_LABEL: Record<string, string> = {
  soft_decline: "رفض غير مباشر",
  awaiting_third_party: "بانتظار طرف ثالث",
  awaiting_external_event: "بانتظار ظرف خارجي",
  busy_reschedule: "مشغول / تأجيل",
};

const DAY_MS = 86_400_000;

export interface HealthDealRow {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  pipeline_stages: { label: string | null; terminal_type: string | null } | null;
}

export interface HealthActivityRow {
  entity_id: string | null;
  occurred_at: string | null;
  direction: string | null;
  situational_tag: string | null;
}

export interface HealthTaskRow {
  /** Deal-linked open tasks only; the caller filters. */
  deal_id: string | null;
  completed_at: string | null;
}

export interface Baselines {
  /** Typical gap between touches on deals that were won. */
  silenceDays: { value: number; sampleSize: number; derived: boolean };
  /** Typical age of a deal at the point it was won. */
  ageDays: { value: number; sampleSize: number; derived: boolean };
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Measures what "normal" looks like for this account, from deals that were
 * actually won.
 *
 * Won deals are the reference on purpose: the question a factor answers is
 * "is this deal behaving like the ones that closed?", and lost deals would
 * drag the baseline toward the behaviour we don't want to normalise.
 */
export function deriveBaselines(
  deals: HealthDealRow[],
  activities: HealthActivityRow[],
): Baselines {
  const won = deals.filter((d) => d.pipeline_stages?.terminal_type === "won");
  const wonIds = new Set(won.map((d) => d.id));

  // Gaps between consecutive touches on won deals.
  const byDeal = new Map<string, number[]>();
  for (const a of activities) {
    if (!a.entity_id || !a.occurred_at || !wonIds.has(a.entity_id)) continue;
    const t = new Date(a.occurred_at).getTime();
    if (Number.isNaN(t)) continue;
    const arr = byDeal.get(a.entity_id) ?? [];
    arr.push(t);
    byDeal.set(a.entity_id, arr);
  }
  const gaps: number[] = [];
  for (const times of byDeal.values()) {
    if (times.length < 2) continue;
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      gaps.push(Math.round((times[i] - times[i - 1]) / DAY_MS));
    }
  }

  const ages: number[] = [];
  for (const d of won) {
    if (!d.created_at || !d.updated_at) continue;
    const days = Math.round(
      (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / DAY_MS,
    );
    if (days >= 0) ages.push(days);
  }

  // The sample that matters for the silence baseline is how many won deals
  // contributed gaps, not how many gaps there are — 40 gaps from one deal is
  // one deal's habits, not the team's.
  const silenceSample = [...byDeal.values()].filter((t) => t.length >= 2).length;

  return {
    silenceDays:
      silenceSample >= MIN_SAMPLE && gaps.length
        ? { value: Math.max(1, median(gaps)), sampleSize: silenceSample, derived: true }
        : { value: FALLBACK_SILENCE_DAYS, sampleSize: silenceSample, derived: false },
    ageDays:
      ages.length >= MIN_SAMPLE
        ? { value: Math.max(1, median(ages)), sampleSize: ages.length, derived: true }
        : { value: FALLBACK_AGE_DAYS, sampleSize: ages.length, derived: false },
  };
}

/**
 * Scores one open deal.
 *
 * `now` is passed in rather than read from the clock so the caller can anchor
 * to the dataset's latest activity — the same anchoring every other time
 * window in this product uses, because the data is historical.
 */
export function computeHealth(
  deal: HealthDealRow,
  activities: HealthActivityRow[],
  hasOpenTask: boolean,
  baselines: Baselines,
  now: number,
): DealHealth {
  const mine = activities
    .filter((a) => a.entity_id === deal.id && a.occurred_at)
    .sort(
      (a, b) => new Date(b.occurred_at!).getTime() - new Date(a.occurred_at!).getTime(),
    );

  const factors: HealthFactor[] = [];
  const clear: string[] = [];

  // ── 1. Turning point on the most recent customer reply ──────────────────
  const latestInbound = mine.find((a) => a.direction === "inbound");
  const tag = latestInbound?.situational_tag ?? null;
  if (tag && (TURNING_POINT_TAGS as readonly string[]).includes(tag)) {
    const daysAgo = Math.floor(
      (now - new Date(latestInbound!.occurred_at!).getTime()) / DAY_MS,
    );
    factors.push({
      key: "turning_point",
      label: "آخر رد من العميل",
      detail: `«${TAG_LABEL[tag] ?? tag}» — قبل ${daysAgo} يوم`,
      contribution: MANUAL_WEIGHTS.turningPoint,
      basis: { kind: "manual" },
    });
  } else {
    clear.push("ما فيه إشارة سلبية في آخر رد");
  }

  // ── 2. Silence, measured against how this account actually works ────────
  const lastTouch = mine[0]?.occurred_at ? new Date(mine[0].occurred_at).getTime() : null;
  const daysSilent = lastTouch == null ? null : Math.floor((now - lastTouch) / DAY_MS);
  const sb = baselines.silenceDays;
  if (daysSilent == null) {
    factors.push({
      key: "silence",
      label: "بدون تواصل",
      detail: "ما فيه أي نشاط مسجّل على هذه الصفقة",
      contribution: -30,
      basis: { kind: "manual" },
    });
  } else if (daysSilent > sb.value) {
    // Scaled by how far past normal it is, capped — a deal silent for a year
    // is not twenty times worse than one silent for a month, it is just bad.
    const over = daysSilent / sb.value;
    const contribution = -Math.min(25, Math.round(5 * over));
    factors.push({
      key: "silence",
      label: "بدون تواصل",
      detail: sb.derived
        ? `${daysSilent} يوم — المعتاد عندكم ${sb.value} يوم`
        : `${daysSilent} يوم`,
      contribution,
      basis: sb.derived
        ? { kind: "derived", sampleSize: sb.sampleSize, baseline: sb.value }
        : { kind: "manual" },
    });
  } else {
    clear.push(`التواصل منتظم (${daysSilent} يوم)`);
  }

  // ── 3. No next step ─────────────────────────────────────────────────────
  if (!hasOpenTask) {
    factors.push({
      key: "no_next_step",
      label: "بدون خطوة تالية",
      detail: "ما فيه مهمة مفتوحة على هذه الصفقة",
      contribution: MANUAL_WEIGHTS.noNextStep,
      basis: { kind: "manual" },
    });
  } else {
    clear.push("فيه مهمة قادمة");
  }

  // ── 4. One-sided conversation ───────────────────────────────────────────
  const inbound = mine.filter((a) => a.direction === "inbound").length;
  const outbound = mine.filter((a) => a.direction === "outbound").length;
  if (outbound >= 3 && inbound === 0) {
    factors.push({
      key: "one_sided",
      label: "محادثة من طرف واحد",
      detail: `${outbound} رسالة منّا، بدون أي رد`,
      contribution: MANUAL_WEIGHTS.oneSided,
      basis: { kind: "manual" },
    });
  } else if (outbound >= 4 && inbound > 0 && outbound / inbound >= 4) {
    factors.push({
      key: "one_sided",
      label: "محادثة من طرف واحد",
      detail: `${outbound} منّا مقابل ${inbound} من العميل`,
      contribution: MANUAL_WEIGHTS.oneSided,
      basis: { kind: "manual" },
    });
  } else if (inbound > 0) {
    clear.push("العميل يتفاعل");
  }

  // ── 5. Age against how long a won deal usually takes ────────────────────
  const ab = baselines.ageDays;
  const ageDays = deal.created_at
    ? Math.floor((now - new Date(deal.created_at).getTime()) / DAY_MS)
    : null;
  if (ageDays != null && ageDays > ab.value) {
    const over = ageDays / ab.value;
    const contribution = -Math.min(20, Math.round(4 * over));
    factors.push({
      key: "age",
      label: "عمر الصفقة",
      detail: ab.derived
        ? `${ageDays} يوم — صفقاتكم المربوحة تُغلق في ${ab.value} يوم`
        : `${ageDays} يوم`,
      contribution,
      basis: ab.derived
        ? { kind: "derived", sampleSize: ab.sampleSize, baseline: ab.value }
        : { kind: "manual" },
    });
  } else if (ageDays != null) {
    clear.push(`العمر ضمن المعتاد (${ageDays} يوم)`);
  }

  const score = Math.max(
    0,
    Math.min(100, 100 + factors.reduce((s, f) => s + f.contribution, 0)),
  );

  return { dealId: deal.id, score, factors, clear };
}
