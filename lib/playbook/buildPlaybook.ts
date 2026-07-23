import { supabase } from "@/lib/supabase";
import { SITUATIONAL_TAGS, type SituationalTag } from "@/lib/classifyActivity";

/** Below this sample size a win rate is noise, not a pattern — flag it instead of hiding it. */
export const MIN_SAMPLE = 4;

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

export interface PlaybookGroup {
  tag: SituationalTag;
  tagLabel: string;
  source: string;
  won: number;
  lost: number;
  total: number;
  winRatePct: number;
  confident: boolean;
  wonValueSAR: number;
  sampleWonMessage: string | null;
  topLostReason: string | null;
}

export interface PlaybookData {
  groups: PlaybookGroup[];
  coverage: { resolvedDeals: number; taggedDeals: number; coveragePct: number };
}

function isSituationalTag(v: string | null): v is SituationalTag {
  return !!v && (SITUATIONAL_TAGS as readonly string[]).includes(v);
}

/**
 * Aggregates every resolved (won/lost) deal by its last-known customer
 * situation (situational_tag) × lead source into real win-rate stats — the
 * same "last inbound tag" signal next-best-action already uses per deal,
 * just rolled up across the whole book instead of one deal at a time.
 *
 * Groups below MIN_SAMPLE are still shown (never hidden) but flagged
 * unconfident, so a thin dataset reads as "not enough data yet" rather than
 * a misleadingly precise percentage.
 */
export async function buildPlaybook(): Promise<PlaybookData> {
  const dealsRes = await supabase
    .from("deals")
    .select(
      "id, name, lead_id, expected_value_minor, won_value_minor, pipeline_stages(label, terminal_type), lost_reasons(label), leads(sources(label))",
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

  type Bucket = { won: number; lost: number; wonValueSAR: number; sampleWonMessage: string | null; lostReasons: Map<string, number> };
  const buckets = new Map<string, Bucket>();

  for (const d of resolved) {
    const dealActsForD = byEntity.get(`deal:${d.id}`) ?? [];
    const leadActsForD = d.lead_id ? byEntity.get(`lead:${d.lead_id}`) ?? [] : [];
    const combined = [...dealActsForD, ...leadActsForD]
      .filter((a) => a.direction === "inbound" && isSituationalTag(a.situational_tag))
      .sort((a, b) => new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime());
    const tag = combined[0]?.situational_tag as SituationalTag | undefined;
    if (!tag) continue; // no classified customer situation — can't place it in the playbook

    const source = d.leads?.sources?.label || "غير محدد";
    const key = `${tag}::${source}`;
    const bucket = buckets.get(key) ?? { won: 0, lost: 0, wonValueSAR: 0, sampleWonMessage: null, lostReasons: new Map() };
    const isWon = d.pipeline_stages?.terminal_type === "won";
    if (isWon) {
      bucket.won++;
      bucket.wonValueSAR += Math.round((d.won_value_minor ?? d.expected_value_minor ?? 0) / 100);
      if (!bucket.sampleWonMessage) {
        const wonMsg = dealActsForD.find((a) => a.direction === "outbound" && a.body)?.body;
        if (wonMsg) bucket.sampleWonMessage = wonMsg.length > 160 ? `${wonMsg.slice(0, 160)}…` : wonMsg;
      }
    } else {
      bucket.lost++;
      const reason = d.lost_reasons?.label || null;
      if (reason) bucket.lostReasons.set(reason, (bucket.lostReasons.get(reason) ?? 0) + 1);
    }
    buckets.set(key, bucket);
  }

  const groups: PlaybookGroup[] = [...buckets.entries()].map(([key, b]) => {
    const [tag, source] = key.split("::") as [SituationalTag, string];
    const total = b.won + b.lost;
    const topLostReason = [...b.lostReasons.entries()].sort((a, b2) => b2[1] - a[1])[0]?.[0] ?? null;
    return {
      tag,
      tagLabel: TAG_LABELS[tag] ?? tag,
      source,
      won: b.won,
      lost: b.lost,
      total,
      winRatePct: total ? Math.round((b.won / total) * 100) : 0,
      confident: total >= MIN_SAMPLE,
      wonValueSAR: b.wonValueSAR,
      sampleWonMessage: b.sampleWonMessage,
      topLostReason,
    };
  });
  groups.sort((a, b) => b.total - a.total);

  const taggedDeals = resolved.filter((d) => {
    const dealActsForD = byEntity.get(`deal:${d.id}`) ?? [];
    const leadActsForD = d.lead_id ? byEntity.get(`lead:${d.lead_id}`) ?? [] : [];
    return [...dealActsForD, ...leadActsForD].some((a) => a.direction === "inbound" && isSituationalTag(a.situational_tag));
  }).length;

  return {
    groups,
    coverage: {
      resolvedDeals: resolved.length,
      taggedDeals,
      coveragePct: resolved.length ? Math.round((taggedDeals / resolved.length) * 100) : 0,
    },
  };
}
