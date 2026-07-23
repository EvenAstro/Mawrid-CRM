import { supabase } from "@/lib/supabase";

export type DateRangeKey = "7d" | "30d" | "90d" | "year" | "all" | "custom";

export interface CustomRange {
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
}

export function rangeToDates(range: DateRangeKey, custom?: CustomRange): { from: Date | null; to: Date | null } {
  const now = new Date();
  if (range === "custom" && custom?.from) {
    const from = new Date(`${custom.from}T00:00:00`);
    const to = custom.to ? new Date(`${custom.to}T23:59:59`) : now;
    return { from, to };
  }
  if (range === "7d") return { from: new Date(now.getTime() - 7 * 86_400_000), to: null };
  if (range === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000), to: null };
  if (range === "90d") return { from: new Date(now.getTime() - 90 * 86_400_000), to: null };
  if (range === "year") return { from: new Date(now.getFullYear(), 0, 1), to: null };
  return { from: null, to: null };
}

interface Stage {
  id: string;
  label: string;
  color: string | null;
  terminal_type: string | null;
  sort_order: number | null;
}
interface LeadRow {
  id: string;
  created_at: string | null;
  junk_reason_id: number | null;
  sources: { label: string | null } | null;
}
interface DealRow {
  id: string;
  name: string | null;
  lead_id: string | null;
  stage_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  probability_pct: number | null;
  created_at: string | null;
  updated_at: string | null;
  pipeline_stages: Stage | null;
  lost_reasons: { label: string | null } | null;
  leads: { full_name: string | null } | null;
}
interface ActivityRow {
  occurred_at: string | null;
}

function valueSAR(d: DealRow): number {
  return Math.round((d.won_value_minor ?? d.expected_value_minor ?? 0) / 100);
}
function inRange(iso: string | null, from: Date | null, to: Date | null): boolean {
  if (!iso) return !from; // undated rows only pass an unfiltered ("all") query
  const t = new Date(iso).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}
function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export interface Breakdown {
  label: string;
  count: number;
  valueSAR: number;
  color: string | null;
}
export interface SourceRow extends Breakdown {
  clean: number;
  junk: number;
  cleanPct: number;
}
export interface TrendPoint {
  date: string;
  label: string;
  pipelineValueSAR: number;
  won: number;
  lost: number;
  newDeals: number;
}
export interface DealRowLite {
  id: string;
  name: string;
  leadName: string | null;
  stage: string;
  valueSAR: number;
  days: number;
  probabilityPct: number | null;
}
export interface LostDealRow {
  id: string;
  name: string;
  leadName: string | null;
  stage: string;
  reason: string;
  valueSAR: number;
  lostAt: string | null;
}
export interface Kpis {
  totalLeads: number;
  cleanLeads: number;
  junkLeads: number;
  activeDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValueSAR: number;
  wonValueSAR: number;
  winRatePct: number;
  avgCycleDays: number | null;
  totalActivities: number;
}

export interface InsightsData {
  range: DateRangeKey;
  rangeLabel: string;
  kpis: Kpis;
  trend: TrendPoint[];
  funnel: Breakdown[];
  sources: SourceRow[];
  lostReasons: Breakdown[];
  topActiveDeals: DealRowLite[];
  recentLostDeals: LostDealRow[];
}

const RANGE_LABELS: Record<DateRangeKey, string> = {
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يوم",
  "90d": "آخر 90 يوم",
  year: "هذي السنة",
  all: "كل الفترات",
  custom: "فترة مخصصة",
};

/**
 * One comprehensive, filterable snapshot of the business — KPIs, a daily
 * pipeline/won/lost trend, a stage funnel, lead-source mix (with junk
 * quality per source), loss reasons, and top-deal/recent-loss tables — all
 * scoped to the same date range so every chart and table on the page agrees
 * with every other one (and with what the embedded AI panel is told).
 */
export async function buildInsights(range: DateRangeKey, custom?: CustomRange): Promise<InsightsData> {
  const { from, to } = rangeToDates(range, custom);

  const [leadsRes, dealsRes, actsRes, stagesRes] = await Promise.all([
    supabase.from("leads").select("id, created_at, junk_reason_id, sources(label)").is("deleted_at", null),
    supabase
      .from("deals")
      .select(
        "id, name, lead_id, stage_id, expected_value_minor, won_value_minor, probability_pct, created_at, updated_at, pipeline_stages(id, label, color, terminal_type, sort_order), lost_reasons(label), leads(full_name)",
      )
      .is("deleted_at", null),
    supabase.from("activities").select("occurred_at"),
    supabase.from("pipeline_stages").select("id, label, color, terminal_type, sort_order").eq("pipeline", "deal").order("sort_order"),
  ]);
  if (leadsRes.error) console.error("[buildInsights] leads fetch failed", leadsRes.error);
  if (dealsRes.error) console.error("[buildInsights] deals fetch failed", dealsRes.error);

  const allLeads = (leadsRes.data as unknown as LeadRow[]) ?? [];
  const allDeals = (dealsRes.data as unknown as DealRow[]) ?? [];
  const allActs = (actsRes.data as unknown as ActivityRow[]) ?? [];
  const stages = (stagesRes.data as unknown as Stage[]) ?? [];

  const leads = allLeads.filter((l) => inRange(l.created_at, from, to));
  // Deals are scoped by the date they were last touched (created or resolved) so a
  // range filter shows deals that were actually active during that window.
  const deals = allDeals.filter((d) => inRange(d.updated_at ?? d.created_at, from, to));
  const activities = allActs.filter((a) => inRange(a.occurred_at, from, to));

  const activeDeals = deals.filter((d) => d.pipeline_stages?.terminal_type == null);
  const wonDeals = deals.filter((d) => d.pipeline_stages?.terminal_type === "won");
  const lostDeals = deals.filter((d) => d.pipeline_stages?.terminal_type === "lost");

  const pipelineValueSAR = activeDeals.reduce((s, d) => s + valueSAR(d), 0);
  const wonValueSAR = wonDeals.reduce((s, d) => s + valueSAR(d), 0);

  let cycleDaysSum = 0;
  let cycleDaysCount = 0;
  for (const d of wonDeals) {
    if (!d.created_at || !d.updated_at) continue;
    const days = (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86_400_000;
    if (days >= 0) {
      cycleDaysSum += days;
      cycleDaysCount++;
    }
  }

  const cleanLeads = leads.filter((l) => l.junk_reason_id == null).length;

  const kpis: Kpis = {
    totalLeads: leads.length,
    cleanLeads,
    junkLeads: leads.length - cleanLeads,
    activeDeals: activeDeals.length,
    wonDeals: wonDeals.length,
    lostDeals: lostDeals.length,
    pipelineValueSAR,
    wonValueSAR,
    winRatePct: wonDeals.length + lostDeals.length ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100) : 0,
    avgCycleDays: cycleDaysCount ? Math.round(cycleDaysSum / cycleDaysCount) : null,
    totalActivities: activities.length,
  };

  // ── Daily trend over the selected range (capped at 90 points) ──
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = to ?? today;
  const start = from ? new Date(from) : new Date(rangeEnd.getTime() - 59 * 86_400_000);
  start.setHours(0, 0, 0, 0);
  const spanRaw = Math.round((rangeEnd.getTime() - start.getTime()) / 86_400_000) + 1;
  const span = Math.min(90, Math.max(1, spanRaw));
  for (let i = span - 1; i >= 0; i--) days.push(new Date(rangeEnd.getTime() - i * 86_400_000));

  const trend: TrendPoint[] = days.map((day) => {
    const key = dayKey(day.toISOString());
    const dayDeals = allDeals.filter((d) => d.created_at && dayKey(d.created_at) === key);
    const dayWon = allDeals.filter((d) => d.pipeline_stages?.terminal_type === "won" && d.updated_at && dayKey(d.updated_at) === key);
    const dayLost = allDeals.filter((d) => d.pipeline_stages?.terminal_type === "lost" && d.updated_at && dayKey(d.updated_at) === key);
    return {
      date: key,
      label: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pipelineValueSAR: dayDeals.filter((d) => d.pipeline_stages?.terminal_type == null).reduce((s, d) => s + valueSAR(d), 0),
      won: dayWon.length,
      lost: dayLost.length,
      newDeals: dayDeals.length,
    };
  });

  // ── Funnel: active deal count per stage, in real pipeline order ──
  const funnelMap = new Map<string, Breakdown>();
  for (const d of activeDeals) {
    const label = d.pipeline_stages?.label || "غير محدد";
    const b = funnelMap.get(label) ?? { label, count: 0, valueSAR: 0, color: d.pipeline_stages?.color ?? null };
    b.count++;
    b.valueSAR += valueSAR(d);
    funnelMap.set(label, b);
  }
  const stageOrder = new Map(stages.map((s, i) => [s.label, s.sort_order ?? i]));
  const funnel = [...funnelMap.values()].sort((a, b) => (stageOrder.get(a.label) ?? 999) - (stageOrder.get(b.label) ?? 999));

  // ── Lead sources, with junk-quality breakdown per source ──
  const sourceMap = new Map<string, { count: number; clean: number; junk: number }>();
  for (const l of leads) {
    const label = l.sources?.label || "غير محدد";
    const s = sourceMap.get(label) ?? { count: 0, clean: 0, junk: 0 };
    s.count++;
    if (l.junk_reason_id == null) s.clean++;
    else s.junk++;
    sourceMap.set(label, s);
  }
  const sources: SourceRow[] = [...sourceMap.entries()]
    .map(([label, s]) => ({
      label,
      count: s.count,
      valueSAR: 0,
      color: null,
      clean: s.clean,
      junk: s.junk,
      cleanPct: s.count ? Math.round((s.clean / s.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── Loss reasons ──
  const reasonMap = new Map<string, Breakdown>();
  for (const d of lostDeals) {
    const label = d.lost_reasons?.label || "غير محدد";
    const b = reasonMap.get(label) ?? { label, count: 0, valueSAR: 0, color: null };
    b.count++;
    b.valueSAR += valueSAR(d);
    reasonMap.set(label, b);
  }
  const lostReasons = [...reasonMap.values()].sort((a, b) => b.count - a.count);

  // ── Tables ──
  const topActiveDeals: DealRowLite[] = [...activeDeals]
    .sort((a, b) => valueSAR(b) - valueSAR(a))
    .slice(0, 10)
    .map((d) => ({
      id: d.id,
      name: d.name || "صفقة بدون اسم",
      leadName: d.leads?.full_name ?? null,
      stage: d.pipeline_stages?.label || "غير محدد",
      valueSAR: valueSAR(d),
      days: d.created_at ? Math.max(0, Math.floor((Date.now() - new Date(d.created_at).getTime()) / 86_400_000)) : 0,
      probabilityPct: d.probability_pct,
    }));

  const recentLostDeals: LostDealRow[] = [...lostDeals]
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    .slice(0, 10)
    .map((d) => ({
      id: d.id,
      name: d.name || "صفقة بدون اسم",
      leadName: d.leads?.full_name ?? null,
      stage: d.pipeline_stages?.label || "غير محدد",
      reason: d.lost_reasons?.label || "غير محدد",
      valueSAR: valueSAR(d),
      lostAt: d.updated_at,
    }));

  return {
    range,
    rangeLabel: RANGE_LABELS[range],
    kpis,
    trend,
    funnel,
    sources,
    lostReasons,
    topActiveDeals,
    recentLostDeals,
  };
}
