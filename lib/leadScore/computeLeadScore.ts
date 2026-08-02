import { supabase } from "@/lib/supabase";

/** Below this per-segment sample size, fall back to the overall base rate — a
 * source with 3 leads shouldn't produce a more "confident" number than one
 * with 3,000. */
const MIN_SAMPLE = 15;

interface RawLead {
  id: string | number;
  junk_reason_id: number | null;
  establishment_id: string | number | null;
  sources: { label: string | null } | null;
}
interface Touchpoint {
  lead_id: string | number;
  campaign_id: string | null;
}

interface RateStat {
  junk: number;
  total: number;
}

export interface LeadScoreModel {
  baseJunkRate: number;
  totalLeads: number;
  bySource: Map<string, RateStat>;
  matched: RateStat;
  hasCampaign: RateStat;
}

function rate(s: RateStat, fallback: number): number {
  return s.total >= MIN_SAMPLE ? s.junk / s.total : fallback;
}

/**
 * Builds the real junk-probability model from every lead that already has a
 * ground-truth label (junk_reason_id set or confirmed absent) — replacing
 * the hardcoded AI_SOURCE_RATES table duplicated across dashboard/page.tsx,
 * leads/page.tsx, lead-scoring/page.tsx, and LeadSlideOver.tsx. Recomputing
 * this from live data means the score gets more accurate as the team labels
 * more leads, instead of being frozen at whatever numbers were guessed once.
 */
export async function fetchLeadScoreModel(): Promise<LeadScoreModel> {
  const [leadsRes, tpsRes] = await Promise.all([
    supabase.from("leads").select("id, junk_reason_id, establishment_id, sources(label)").is("deleted_at", null),
    supabase.from("lead_touchpoints").select("lead_id, campaign_id"),
  ]);
  if (leadsRes.error) console.error("[leadScore] leads fetch failed", leadsRes.error);
  if (tpsRes.error) console.error("[leadScore] lead_touchpoints fetch failed", tpsRes.error);

  const leads = (leadsRes.data as unknown as RawLead[]) ?? [];
  const tps = (tpsRes.data as unknown as Touchpoint[]) ?? [];

  const campaignLeadIds = new Set(
    tps.filter((t) => t.campaign_id && t.campaign_id !== "--").map((t) => String(t.lead_id)),
  );

  const bySource = new Map<string, RateStat>();
  let totalJunk = 0;
  const matched: RateStat = { junk: 0, total: 0 };
  const hasCampaign: RateStat = { junk: 0, total: 0 };

  for (const l of leads) {
    const isJunk = l.junk_reason_id != null;
    if (isJunk) totalJunk++;

    const source = l.sources?.label || "غير محدد";
    const s = bySource.get(source) ?? { junk: 0, total: 0 };
    s.total++;
    if (isJunk) s.junk++;
    bySource.set(source, s);

    if (l.establishment_id) {
      matched.total++;
      if (isJunk) matched.junk++;
    }
    if (campaignLeadIds.has(String(l.id))) {
      hasCampaign.total++;
      if (isJunk) hasCampaign.junk++;
    }
  }

  return {
    baseJunkRate: leads.length ? totalJunk / leads.length : 0.5,
    totalLeads: leads.length,
    bySource,
    matched,
    hasCampaign,
  };
}

export interface LeadScoreInput {
  source: string;
  matched: boolean;
  hasCampaign: boolean;
}

export interface LeadScoreResult {
  score: number; // 0-100, higher = cleaner / more genuine
  pJunk: number;
  sourceRatePct: number;
  sourceSampleSize: number;
  confident: boolean;
  reasons: string[];
}

/** Scores one lead against a model built by fetchLeadScoreModel(). Same shape
 * as the old hardcoded version (source rate × matched/campaign multipliers)
 * so it's a predictable drop-in — only the numbers are now real. */
export function scoreWithModel(model: LeadScoreModel, input: LeadScoreInput): LeadScoreResult {
  const seg = model.bySource.get(input.source);
  const sourceRate = seg ? rate(seg, model.baseJunkRate) : model.baseJunkRate;
  const sourceConfident = !!seg && seg.total >= MIN_SAMPLE;

  let p = sourceRate;
  const reasons: string[] = [
    sourceConfident
      ? `نسبة الجانك التاريخية لمصدر "${input.source}": ${Math.round(sourceRate * 100)}% (من ${seg!.total} ليد)`
      : `ما عندنا بيانات كافية لمصدر "${input.source}" بعد — نستخدم المتوسط العام (${Math.round(model.baseJunkRate * 100)}%)`,
  ];

  if (input.matched && model.baseJunkRate > 0) {
    const matchedConfident = model.matched.total >= MIN_SAMPLE;
    const matchedRate = rate(model.matched, model.baseJunkRate);
    if (matchedConfident) {
      p *= matchedRate / model.baseJunkRate;
      reasons.push(`مطابق لمنشأة موجودة — نسبة الجانك بين الليدات المطابقة ${Math.round(matchedRate * 100)}% فقط (من ${model.matched.total} ليد)`);
    }
  }
  if (input.hasCampaign && model.baseJunkRate > 0) {
    const campaignConfident = model.hasCampaign.total >= MIN_SAMPLE;
    const campaignRate = rate(model.hasCampaign, model.baseJunkRate);
    if (campaignConfident) {
      p *= campaignRate / model.baseJunkRate;
      reasons.push(`جاء من حملة إعلانية — نسبة الجانك لليدات الحملات ${Math.round(campaignRate * 100)}% (من ${model.hasCampaign.total} ليد)`);
    }
  }

  p = Math.min(1, Math.max(0, p));
  return {
    score: Math.round((1 - p) * 100),
    pJunk: p,
    sourceRatePct: Math.round(sourceRate * 100),
    sourceSampleSize: seg?.total ?? 0,
    confident: sourceConfident,
    reasons,
  };
}

export function getAIScore(
  lead: { sources?: { label?: string } | null; establishment_id?: string | number | null },
  model: LeadScoreModel | null,
): number {
  if (!model) return 50;
  return scoreWithModel(model, {
    source: lead.sources?.label || "غير محدد",
    matched: !!lead.establishment_id,
    hasCampaign: false,
  }).score;
}
