import { supabase } from "@/lib/supabase";
import { SITUATIONAL_TAGS, type SituationalTag } from "@/lib/classifyActivity";

/** Below this sample size we don't hide the group — but we don't call it a
 * "confirmed pattern" either. Confidence-interval width and MIN_SAMPLE
 * together are what mark a group as trustworthy. */
export const MIN_SAMPLE = 4;

/** Max age between an inbound classification and the deal's close before we
 * treat the classification as stale (not representative of what the customer
 * was actually thinking at close). 60 days is generous for a B2B sales cycle. */
const MAX_TAG_AGE_MS = 60 * 86_400_000;

export const TAG_LABELS: Record<SituationalTag, string> = {
  price_objection: "اعتراض على السعر",
  technical_concern: "استفسار تقني",
  positive_interest: "اهتمام إيجابي",
  awaiting_third_party: "بانتظار طرف ثالث",
  awaiting_external_event: "بانتظار ظرف خارجي",
  busy_reschedule: "مشغول / تأجيل",
  soft_decline: "رفض غير مباشر",
  comparing_options: "يقارن بدائل",
  requesting_callback: "يطلب اتصال لاحق",
  acknowledgment_only: "رد بدون معلومة",
  complaint: "شكوى",
  other: "أخرى",
};

/** Short, one-line description of what each objection actually means — so the
 * page reads like a briefing, not a list of internal enum values. */
export const TAG_DESCRIPTIONS: Record<SituationalTag, string> = {
  price_objection: "العميل يقول إن السعر مرتفع أو يطلب تخفيض",
  technical_concern: "سؤال تقني أو مشكلة بالمنتج/الخدمة",
  positive_interest: "العميل مهتم فعلاً ويؤكد الاجتماع أو الطلب",
  awaiting_third_party: "ينتظر قرار شخص ثاني (محاسب، مدير، شريك)",
  awaiting_external_event: "ينتظر ظرف خارجي (تحصيل من عميله، آخر موسم)",
  busy_reschedule: "مشغول ويطلب تأجيل",
  soft_decline: "رفض غير مباشر أو تسويف بدون سبب واضح",
  comparing_options: "يقارن مع منافس أو بديل",
  requesting_callback: "يطلب معاودة الاتصال بوقت محدد",
  acknowledgment_only: "رد قصير بدون معلومة (شكراً، تمام)",
  complaint: "شكوى من الخدمة أو المنتج",
  other: "حالة غير مصنّفة",
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface DealRow {
  id: string;
  name: string | null;
  lead_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  created_at: string | null;
  updated_at: string | null;
  pipeline_stages: { label: string | null; terminal_type: string | null } | null;
  lost_reasons: { label: string | null } | null;
  leads: { sources: { label: string | null } | null } | null;
}

interface ActivityRow {
  entity_type: string | null;
  entity_id: string | null;
  direction: string | null;
  occurred_at: string | null;
  body: string | null;
  situational_tag: string | null;
}

export interface LossReasonRow {
  reason: string;
  count: number;
}

export interface PlaybookGroup {
  tag: SituationalTag;
  tagLabel: string;
  tagDescription: string;
  source: string;
  won: number;
  lost: number;
  total: number;
  winRatePct: number;
  /** Wilson score 95% confidence interval — lower/upper bounds on the true win rate. */
  winRateLowPct: number;
  winRateHighPct: number;
  /** Percentage-point lift vs. the overall baseline win rate — positive means
   * this segment closes above average, negative means below. */
  liftPP: number;
  confident: boolean;
  wonValueSAR: number;
  /** How many of the won deals in this group had no captured value (so the
   * total above understates by an unknown amount). */
  wonValueMissingCount: number;
  /** Up to 3 closing-move examples — the LAST outbound message before each
   * won deal, i.e. what was actually said just before it closed. */
  wonClosingMessages: string[];
  /** Full ranked list of loss reasons (label + count). Total always equals
   * `lost`; deals with no captured reason land under "غير مسجّل". */
  lossReasons: LossReasonRow[];
}

export interface PlaybookHighlights {
  bestGroup: PlaybookGroup | null;
  worstGroup: PlaybookGroup | null;
  bestObjection: { tag: SituationalTag; tagLabel: string; winRatePct: number; total: number } | null;
  hardestObjection: { tag: SituationalTag; tagLabel: string; winRatePct: number; total: number } | null;
  bestSource: { source: string; winRatePct: number; total: number } | null;
}

/** One row of the "by objection" / "by source" leaderboards — rolled up
 * across all sub-groups so the reader gets the big picture before diving
 * into the tag × source detail cards. */
export interface LeaderboardRow {
  key: string;
  label: string;
  winRatePct: number;
  total: number;
  liftPP: number;
  confident: boolean;
}

/** Transparent breakdown of why some resolved deals didn't make it into the
 * playbook — surfaced on the page so the user can see the true data quality
 * instead of trusting one aggregate coverage %. */
export interface DataQualityReport {
  resolvedDeals: number;
  includedDeals: number;
  excludedNoInbound: number;
  excludedNoTag: number;
  excludedStaleTag: number;
  wonDealsMissingValue: number;
  lostDealsMissingReason: number;
  closeDateSource: { fromUpdated: number; fromCreated: number; missing: number };
}

export interface PlaybookData {
  groups: PlaybookGroup[];
  coverage: { resolvedDeals: number; taggedDeals: number; coveragePct: number };
  /** Overall win rate across every classified resolved deal — the yardstick
   * we compare each group's win rate against (via liftPP). */
  baselineWinRatePct: number;
  highlights: PlaybookHighlights;
  /** The distinct list of source labels present across all groups, for filters. */
  sources: string[];
  /** Per-deal data-quality accounting — see DataQualityReport. */
  quality: DataQualityReport;
  /** Win rate rolled up per objection tag (across all sources), sorted best-first. */
  byObjection: LeaderboardRow[];
  /** Win rate rolled up per lead source (across all objections), sorted best-first. */
  bySource: LeaderboardRow[];
}

function isSituationalTag(v: string | null): v is SituationalTag {
  return !!v && (SITUATIONAL_TAGS as readonly string[]).includes(v);
}

/** Wilson score interval — a proper 95% confidence interval on a binomial
 * proportion. Way more honest than raw % for small samples: 3/4 wins looks
 * like 75% but its interval is [30%, 95%], which correctly communicates "we
 * really don't know yet." */
function wilsonInterval(successes: number, trials: number): [number, number] {
  if (trials === 0) return [0, 0];
  const z = 1.96;
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const centre = p + (z * z) / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * trials)) / trials);
  const low = Math.max(0, (centre - margin) / denom);
  const high = Math.min(1, (centre + margin) / denom);
  return [low, high];
}

/**
 * Aggregates every resolved (won/lost) deal by its last-known customer
 * situation (situational_tag) × lead source into real win-rate stats. Every
 * number here is derived from data on the deals + activities tables — no
 * LLM guesswork.
 *
 * Data-quality rules applied here:
 * - The classification for a deal is the LAST inbound tag that occurred
 *   BEFORE the deal's close date (updated_at, falling back to created_at,
 *   falling back to "now"). Tags added after close are ignored.
 * - Same rule for closing-move outbound messages.
 * - Won deals with no captured monetary value are counted in a separate
 *   `wonValueMissingCount` field so a low `wonValueSAR` doesn't silently
 *   mislead the reader.
 * - Lost deals with no captured `lost_reason` are always shown under a
 *   "غير مسجّل" bucket so the sum of reasons always equals `lost`.
 * - Every excluded deal is counted in a DataQualityReport surfaced to the
 *   page, so coverage isn't presented as a single opaque percentage.
 */
export async function buildPlaybook(): Promise<PlaybookData> {
  const dealsRes = await supabase
    .from("deals")
    .select(
      "id, name, lead_id, expected_value_minor, won_value_minor, created_at, updated_at, pipeline_stages(label, terminal_type), lost_reasons(label), leads(sources(label))",
    )
    .is("deleted_at", null);
  if (dealsRes.error) console.error("[buildPlaybook] deals fetch failed", dealsRes.error);

  const allDeals = (dealsRes.data as unknown as DealRow[]) ?? [];
  const resolved = allDeals.filter(
    (d) => d.pipeline_stages?.terminal_type === "won" || d.pipeline_stages?.terminal_type === "lost",
  );

  const dealIds = resolved.map((d) => d.id);
  const leadIds = resolved.map((d) => d.lead_id).filter((id): id is string => !!id);
  const cols = "entity_type, entity_id, direction, occurred_at, body, situational_tag";

  const [dealActs, leadActs] = await Promise.all([
    Promise.all(
      chunk(dealIds, 50).map(async (c) => {
        if (!c.length) return [] as ActivityRow[];
        const { data, error } = await supabase.from("activities").select(cols).eq("entity_type", "deal").in("entity_id", c);
        if (error) console.error("[buildPlaybook] deal-activities chunk failed", error);
        return (data as unknown as ActivityRow[]) ?? [];
      }),
    ),
    Promise.all(
      chunk(leadIds, 50).map(async (c) => {
        if (!c.length) return [] as ActivityRow[];
        const { data, error } = await supabase.from("activities").select(cols).eq("entity_type", "lead").in("entity_id", c);
        if (error) console.error("[buildPlaybook] lead-activities chunk failed", error);
        return (data as unknown as ActivityRow[]) ?? [];
      }),
    ),
  ]);
  const allActs = [...dealActs.flat(), ...leadActs.flat()];

  const byEntity = new Map<string, ActivityRow[]>();
  for (const a of allActs) {
    if (!a.entity_type || !a.entity_id) continue;
    const key = `${a.entity_type}:${a.entity_id}`;
    const arr = byEntity.get(key) ?? [];
    arr.push(a);
    byEntity.set(key, arr);
  }

  type Bucket = {
    won: number;
    lost: number;
    wonValueSAR: number;
    wonValueMissingCount: number;
    closingMessages: string[];
    /** null key = "غير مسجّل" (loss reason wasn't captured on the deal) */
    lostReasons: Map<string | null, number>;
  };
  const buckets = new Map<string, Bucket>();

  let overallWon = 0;
  let overallTotal = 0;

  const quality: DataQualityReport = {
    resolvedDeals: resolved.length,
    includedDeals: 0,
    excludedNoInbound: 0,
    excludedNoTag: 0,
    excludedStaleTag: 0,
    wonDealsMissingValue: 0,
    lostDealsMissingReason: 0,
    closeDateSource: { fromUpdated: 0, fromCreated: 0, missing: 0 },
  };

  for (const d of resolved) {
    const dealActsForD = byEntity.get(`deal:${d.id}`) ?? [];
    const leadActsForD = d.lead_id ? byEntity.get(`lead:${d.lead_id}`) ?? [] : [];
    const combined = [...dealActsForD, ...leadActsForD];

    // Establish the deal's presumed close cutoff. updated_at is the best signal
    // we have without a dedicated closed_at column; if that's missing we fall
    // back to created_at, and only as a last resort to "now" (which is a real
    // data-quality issue and gets counted).
    let closeMs: number;
    if (d.updated_at) {
      closeMs = new Date(d.updated_at).getTime();
      quality.closeDateSource.fromUpdated++;
    } else if (d.created_at) {
      closeMs = new Date(d.created_at).getTime();
      quality.closeDateSource.fromCreated++;
    } else {
      closeMs = Date.now();
      quality.closeDateSource.missing++;
    }

    // Only consider inbound tags that occurred BEFORE the deal closed, so a
    // stray tag added after the close doesn't reclassify a completed deal.
    const inboundBeforeClose = combined
      .filter(
        (a) =>
          a.direction === "inbound" &&
          isSituationalTag(a.situational_tag) &&
          a.occurred_at &&
          new Date(a.occurred_at).getTime() <= closeMs,
      )
      .sort((a, b) => new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime());

    const anyInbound = combined.some((a) => a.direction === "inbound");
    const anyTaggedInboundEver = combined.some((a) => a.direction === "inbound" && isSituationalTag(a.situational_tag));

    if (!anyInbound) {
      quality.excludedNoInbound++;
      continue;
    }
    if (!anyTaggedInboundEver) {
      quality.excludedNoTag++;
      continue;
    }
    if (inboundBeforeClose.length === 0) {
      // Every classified inbound is dated AFTER close — the tag is stale.
      quality.excludedStaleTag++;
      continue;
    }

    // Guard against wildly stale classifications: if the last inbound tag is
    // older than MAX_TAG_AGE_MS before close, its representativeness is weak.
    const lastTag = inboundBeforeClose[0];
    const tagAge = closeMs - new Date(lastTag.occurred_at as string).getTime();
    if (tagAge > MAX_TAG_AGE_MS) {
      quality.excludedStaleTag++;
      continue;
    }

    const tag = lastTag.situational_tag as SituationalTag;
    const source = d.leads?.sources?.label || "غير محدد";
    const key = `${tag}::${source}`;
    const bucket = buckets.get(key) ?? {
      won: 0,
      lost: 0,
      wonValueSAR: 0,
      wonValueMissingCount: 0,
      closingMessages: [] as string[],
      lostReasons: new Map<string | null, number>(),
    };

    const isWon = d.pipeline_stages?.terminal_type === "won";
    overallTotal++;
    quality.includedDeals++;

    if (isWon) {
      overallWon++;
      bucket.won++;

      const rawValue = d.won_value_minor ?? d.expected_value_minor;
      if (rawValue == null) {
        bucket.wonValueMissingCount++;
        quality.wonDealsMissingValue++;
      } else {
        bucket.wonValueSAR += Math.round(rawValue / 100);
      }

      // Closing move: the LAST outbound message strictly before close.
      const lastOutbound = dealActsForD
        .filter(
          (a) =>
            a.direction === "outbound" &&
            a.body &&
            a.occurred_at &&
            new Date(a.occurred_at).getTime() <= closeMs,
        )
        .sort((a, b) => new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime())[0];
      if (lastOutbound?.body && bucket.closingMessages.length < 3) {
        const trimmed = lastOutbound.body.length > 200 ? `${lastOutbound.body.slice(0, 200)}…` : lastOutbound.body;
        if (!bucket.closingMessages.includes(trimmed)) bucket.closingMessages.push(trimmed);
      }
    } else {
      bucket.lost++;
      const reason = d.lost_reasons?.label || null;
      // Always count the deal — null-reason lands under a dedicated bucket
      // instead of silently disappearing. This way sum(lossReasons) === lost.
      bucket.lostReasons.set(reason, (bucket.lostReasons.get(reason) ?? 0) + 1);
      if (reason == null) quality.lostDealsMissingReason++;
    }
    buckets.set(key, bucket);
  }

  const baselineWinRate = overallTotal ? overallWon / overallTotal : 0;
  const baselineWinRatePct = Math.round(baselineWinRate * 100);

  const groups: PlaybookGroup[] = [...buckets.entries()].map(([key, b]) => {
    const [tag, source] = key.split("::") as [SituationalTag, string];
    const total = b.won + b.lost;
    const [low, high] = wilsonInterval(b.won, total);
    const rate = total ? b.won / total : 0;
    const lossReasons: LossReasonRow[] = [...b.lostReasons.entries()]
      .map(([reason, count]) => ({ reason: reason ?? "غير مسجّل", count }))
      .sort((a, c) => c.count - a.count);
    return {
      tag,
      tagLabel: TAG_LABELS[tag] ?? tag,
      tagDescription: TAG_DESCRIPTIONS[tag] ?? "",
      source,
      won: b.won,
      lost: b.lost,
      total,
      winRatePct: Math.round(rate * 100),
      winRateLowPct: Math.round(low * 100),
      winRateHighPct: Math.round(high * 100),
      liftPP: Math.round((rate - baselineWinRate) * 100),
      confident: total >= MIN_SAMPLE,
      wonValueSAR: b.wonValueSAR,
      wonValueMissingCount: b.wonValueMissingCount,
      wonClosingMessages: b.closingMessages,
      lossReasons,
    };
  });
  groups.sort((a, b) => b.total - a.total);

  // ── Highlights: pull out the single biggest signals worth flagging ──
  const confident = groups.filter((g) => g.confident);
  const bestGroup = confident.length ? [...confident].sort((a, b) => b.winRatePct - a.winRatePct)[0] : null;
  const worstGroup = confident.length ? [...confident].sort((a, b) => a.winRatePct - b.winRatePct)[0] : null;

  // Roll up per objection tag (across all sources) for confident stats
  const perTag = new Map<SituationalTag, { won: number; total: number }>();
  const perSource = new Map<string, { won: number; total: number }>();
  for (const g of groups) {
    const t = perTag.get(g.tag) ?? { won: 0, total: 0 };
    t.won += g.won;
    t.total += g.total;
    perTag.set(g.tag, t);
    const s = perSource.get(g.source) ?? { won: 0, total: 0 };
    s.won += g.won;
    s.total += g.total;
    perSource.set(g.source, s);
  }
  const tagWins = [...perTag.entries()]
    .filter(([, v]) => v.total >= MIN_SAMPLE)
    .map(([tag, v]) => ({ tag, tagLabel: TAG_LABELS[tag] ?? tag, winRatePct: Math.round((v.won / v.total) * 100), total: v.total }));
  const sourceWins = [...perSource.entries()]
    .filter(([, v]) => v.total >= MIN_SAMPLE)
    .map(([source, v]) => ({ source, winRatePct: Math.round((v.won / v.total) * 100), total: v.total }));

  const bestObjection = tagWins.length ? [...tagWins].sort((a, b) => b.winRatePct - a.winRatePct)[0] : null;
  const hardestObjection = tagWins.length ? [...tagWins].sort((a, b) => a.winRatePct - b.winRatePct)[0] : null;
  const bestSource = sourceWins.length ? [...sourceWins].sort((a, b) => b.winRatePct - a.winRatePct)[0] : null;

  const sources = [...new Set(groups.map((g) => g.source))].sort();

  // Full leaderboards (not just the single best/worst) — every tag/source
  // that has at least one resolved deal, sorted best win-rate first. Groups
  // below MIN_SAMPLE are still shown but flagged as not-confident.
  const byObjection: LeaderboardRow[] = [...perTag.entries()]
    .map(([tag, v]) => ({
      key: tag,
      label: TAG_LABELS[tag] ?? tag,
      winRatePct: v.total ? Math.round((v.won / v.total) * 100) : 0,
      total: v.total,
      liftPP: v.total ? Math.round((v.won / v.total - baselineWinRate) * 100) : 0,
      confident: v.total >= MIN_SAMPLE,
    }))
    .sort((a, b) => b.winRatePct - a.winRatePct);

  const bySource: LeaderboardRow[] = [...perSource.entries()]
    .map(([source, v]) => ({
      key: source,
      label: source,
      winRatePct: v.total ? Math.round((v.won / v.total) * 100) : 0,
      total: v.total,
      liftPP: v.total ? Math.round((v.won / v.total - baselineWinRate) * 100) : 0,
      confident: v.total >= MIN_SAMPLE,
    }))
    .sort((a, b) => b.winRatePct - a.winRatePct);

  return {
    groups,
    coverage: {
      resolvedDeals: resolved.length,
      taggedDeals: quality.includedDeals,
      coveragePct: resolved.length ? Math.round((quality.includedDeals / resolved.length) * 100) : 0,
    },
    baselineWinRatePct,
    highlights: { bestGroup, worstGroup, bestObjection, hardestObjection, bestSource },
    sources,
    quality,
    byObjection,
    bySource,
  };
}
