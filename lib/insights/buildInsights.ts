import { supabase } from "@/lib/supabase";

export type DateRangeKey = "7d" | "30d" | "90d" | "year" | "all";

export function rangeToDate(range: DateRangeKey): Date | null {
  const now = new Date();
  if (range === "7d") return new Date(now.getTime() - 7 * 86_400_000);
  if (range === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  if (range === "90d") return new Date(now.getTime() - 90 * 86_400_000);
  if (range === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
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
  stage_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  created_at: string | null;
  updated_at: string | null;
  pipeline_stages: Stage | null;
  lost_reasons: { label: string | null } | null;
}
interface ActivityRow {
  occurred_at: string | null;
}

function valueSAR(d: DealRow): number {
  return Math.round((d.won_value_minor ?? d.expected_value_minor ?? 0) / 100);
}
function inRange(iso: string | null, from: Date | null): boolean {
  if (!from) return true;
  if (!iso) return false;
  return new Date(iso).getTime() >= from.getTime();
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
export interface TrendPoint {
  date: string;
  label: string;
  pipelineValueSAR: number;
  won: number;
  lost: number;
  newDeals: number;
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
  sources: Breakdown[];
  lostReasons: Breakdown[];
}

const RANGE_LABELS: Record<DateRangeKey, string> = {
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يوم",
  "90d": "آخر 90 يوم",
  year: "هذي السنة",
  all: "كل الفترات",
};

/**
 * One comprehensive, filterable snapshot of the business — KPIs, a daily
 * pipeline/won/lost trend, a stage funnel, lead-source mix, and loss reasons
 * — all scoped to the same date range so every chart on the page agrees
 * with every other chart (and with what the embedded AI panel is told).
 */
export async function buildInsights(range: DateRangeKey): Promise<InsightsData> {
  const from = rangeToDate(range);

  const [leadsRes, dealsRes, actsRes, stagesRes] = await Promise.all([
    supabase.from("leads").select("id, created_at, junk_reason_id, sources(label)").is("deleted_at", null),
    supabase
      .from("deals")
      .select("id, stage_id, expected_value_minor, won_value_minor, created_at, updated_at, pipeline_stages(id, label, color, terminal_type, sort_order), lost_reasons(label)")
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

  const leads = allLeads.filter((l) => inRange(l.created_at, from));
  // Deals are scoped by the date they were last touched (created or resolved) so a
  // range filter shows deals that were actually active during that window.
  const deals = allDeals.filter((d) => inRange(d.updated_at ?? d.created_at, from));
  const activities = allActs.filter((a) => inRange(a.occurred_at, from));

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

  // ── Daily trend over the selected range (capped at 60 points for "all") ──
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = from ? new Date(from) : new Date(today.getTime() - 59 * 86_400_000);
  start.setHours(0, 0, 0, 0);
  const span = Math.min(90, Math.max(1, Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1));
  for (let i = span - 1; i >= 0; i--) days.push(new Date(today.getTime() - i * 86_400_000));

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

  // ── Lead sources ──
  const sourceMap = new Map<string, Breakdown>();
  for (const l of leads) {
    const label = l.sources?.label || "غير محدد";
    const b = sourceMap.get(label) ?? { label, count: 0, valueSAR: 0, color: null };
    b.count++;
    sourceMap.set(label, b);
  }
  const sources = [...sourceMap.values()].sort((a, b) => b.count - a.count);

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

  return { range, rangeLabel: RANGE_LABELS[range], kpis, trend, funnel, sources, lostReasons };
}
