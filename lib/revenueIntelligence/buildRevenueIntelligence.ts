import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

export type DealCategory = "commit" | "best_case" | "pipeline" | "won" | "lost";
export type RiskLevel = "high" | "medium" | "low";

export interface RIDeal {
  id: string;
  name: string;
  leadName: string | null;
  stage: string;
  stageColor: string | null;
  valueSAR: number;
  probabilityPct: number;
  category: DealCategory;
  riskLevel: RiskLevel;
  riskReasons: string[];
  daysSinceActivity: number | null;
  daysInStage: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ForecastScenario {
  label: string;
  valueSAR: number;
  dealCount: number;
  color: string;
}

export interface WeeklySnapshot {
  weekLabel: string;
  weekStart: string;
  wonSAR: number;
  lostSAR: number;
  newPipelineSAR: number;
  wonCount: number;
}

export interface CategorySummary {
  category: DealCategory;
  label: string;
  color: string;
  bgColor: string;
  count: number;
  totalSAR: number;
  weightedSAR: number;
}

export interface RevenueIntelligenceData {
  asOf: string;
  totalPipelineSAR: number;
  weightedPipelineSAR: number;
  wonThisMonthSAR: number;
  wonThisMonthCount: number;
  lostThisMonthCount: number;
  atRiskSAR: number;
  atRiskCount: number;
  forecast: ForecastScenario[];
  categories: CategorySummary[];
  deals: RIDeal[];
  weeklyHistory: WeeklySnapshot[];
  winRateThisMonth: number;
  avgDealSAR: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function valueSAR(minor: number | null): number {
  return Math.round((minor ?? 0) / 100);
}

function daysBetween(a: string | null, b: Date = new Date()): number {
  if (!a) return 0;
  return Math.max(0, Math.floor((b.getTime() - new Date(a).getTime()) / 86_400_000));
}

function weekStart(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

function weekKey(d: Date): string {
  return weekStart(d).toISOString().slice(0, 10);
}

function classifyDeal(
  probabilityPct: number,
  daysSinceActivity: number | null,
  daysInStage: number,
): { category: DealCategory; riskLevel: RiskLevel; riskReasons: string[] } {
  const riskReasons: string[] = [];
  let riskScore = 0;

  if (daysSinceActivity !== null && daysSinceActivity > 14) {
    riskReasons.push(`لا يوجد تواصل منذ ${daysSinceActivity} يوم`);
    riskScore += daysSinceActivity > 21 ? 3 : 2;
  }
  if (daysInStage > 30) {
    riskReasons.push(`في نفس المرحلة منذ ${daysInStage} يوم`);
    riskScore += daysInStage > 60 ? 3 : 1;
  }
  if (probabilityPct < 20) {
    riskReasons.push("احتمالية إغلاق منخفضة جداً");
    riskScore += 2;
  }

  const riskLevel: RiskLevel = riskScore >= 4 ? "high" : riskScore >= 2 ? "medium" : "low";

  let category: DealCategory;
  if (probabilityPct >= 80 && riskLevel === "low") {
    category = "commit";
  } else if (probabilityPct >= 50 || (probabilityPct >= 30 && riskLevel !== "high")) {
    category = "best_case";
  } else {
    category = "pipeline";
  }

  return { category, riskLevel, riskReasons };
}

// ── Main builder ───────────────────────────────────────────────────────────

export async function buildRevenueIntelligence(): Promise<RevenueIntelligenceData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 86_400_000);

  const [dealsRes, activitiesRes] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, name, expected_value_minor, won_value_minor, probability_pct, created_at, updated_at, stage_id, pipeline_stages(id, label, color, terminal_type, sort_order), leads(full_name)",
      )
      .is("deleted_at", null),
    supabase
      .from("activities")
      .select("entity_id, entity_type, occurred_at")
      .eq("entity_type", "deal")
      .gte("occurred_at", twelveWeeksAgo.toISOString()),
  ]);

  const allDeals = (dealsRes.data as unknown as Array<{
    id: string;
    name: string | null;
    expected_value_minor: number | null;
    won_value_minor: number | null;
    probability_pct: number | null;
    created_at: string | null;
    updated_at: string | null;
    stage_id: string | null;
    pipeline_stages: { id: string; label: string; color: string | null; terminal_type: string | null; sort_order: number | null } | null;
    leads: { full_name: string | null } | null;
  }>) ?? [];

  const allActivities = (activitiesRes.data ?? []) as Array<{
    entity_id: string;
    entity_type: string;
    occurred_at: string | null;
  }>;

  // Last activity date per deal
  const lastActivityByDeal = new Map<string, string>();
  for (const a of allActivities) {
    if (!a.occurred_at) continue;
    const prev = lastActivityByDeal.get(a.entity_id);
    if (!prev || a.occurred_at > prev) lastActivityByDeal.set(a.entity_id, a.occurred_at);
  }

  const activeDeals = allDeals.filter((d) => d.pipeline_stages?.terminal_type == null);
  const wonDeals = allDeals.filter((d) => d.pipeline_stages?.terminal_type === "won");
  const lostDeals = allDeals.filter((d) => d.pipeline_stages?.terminal_type === "lost");

  const wonThisMonth = wonDeals.filter((d) => d.updated_at && new Date(d.updated_at) >= monthStart);
  const lostThisMonth = lostDeals.filter((d) => d.updated_at && new Date(d.updated_at) >= monthStart);

  // Build enriched active deals
  const riDeals: RIDeal[] = activeDeals.map((d) => {
    const lastAct = lastActivityByDeal.get(d.id) ?? null;
    const daysSinceActivity = lastAct ? daysBetween(lastAct) : null;
    const daysInStage = daysBetween(d.updated_at ?? d.created_at);
    const prob = d.probability_pct ?? 30;
    const { category, riskLevel, riskReasons } = classifyDeal(prob, daysSinceActivity, daysInStage);

    return {
      id: d.id,
      name: d.name || "صفقة بدون اسم",
      leadName: d.leads?.full_name ?? null,
      stage: d.pipeline_stages?.label || "غير محدد",
      stageColor: d.pipeline_stages?.color ?? null,
      valueSAR: valueSAR(d.expected_value_minor),
      probabilityPct: prob,
      category,
      riskLevel,
      riskReasons,
      daysSinceActivity,
      daysInStage,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  });

  // Totals
  const totalPipelineSAR = riDeals.reduce((s, d) => s + d.valueSAR, 0);
  const weightedPipelineSAR = riDeals.reduce((s, d) => s + Math.round((d.valueSAR * d.probabilityPct) / 100), 0);
  const wonThisMonthSAR = wonThisMonth.reduce((s, d) => s + valueSAR(d.won_value_minor ?? d.expected_value_minor), 0);
  const atRiskDeals = riDeals.filter((d) => d.riskLevel === "high");
  const atRiskSAR = atRiskDeals.reduce((s, d) => s + d.valueSAR, 0);

  // Win rate this month
  const closedThisMonth = wonThisMonth.length + lostThisMonth.length;
  const winRateThisMonth = closedThisMonth > 0 ? Math.round((wonThisMonth.length / closedThisMonth) * 100) : 0;

  // Avg deal value (all active)
  const avgDealSAR = riDeals.length > 0 ? Math.round(totalPipelineSAR / riDeals.length) : 0;

  // Forecast scenarios
  const commitDeals = riDeals.filter((d) => d.category === "commit");
  const bestCaseDeals = riDeals.filter((d) => d.category === "commit" || d.category === "best_case");

  const forecast: ForecastScenario[] = [
    {
      label: "متحفظ",
      valueSAR: commitDeals.reduce((s, d) => s + Math.round((d.valueSAR * d.probabilityPct) / 100), 0) + wonThisMonthSAR,
      dealCount: commitDeals.length,
      color: "#1a5c4f",
    },
    {
      label: "واقعي",
      valueSAR: weightedPipelineSAR + wonThisMonthSAR,
      dealCount: riDeals.length,
      color: "#2d8570",
    },
    {
      label: "متفائل",
      valueSAR: bestCaseDeals.reduce((s, d) => s + d.valueSAR, 0) + wonThisMonthSAR,
      dealCount: bestCaseDeals.length,
      color: "#34a388",
    },
  ];

  // Category summaries
  const categoryMeta: Record<DealCategory, { label: string; color: string; bgColor: string }> = {
    commit: { label: "مؤكدة", color: "#1a5c4f", bgColor: "#f0faf7" },
    best_case: { label: "محتملة", color: "#2563eb", bgColor: "#eff6ff" },
    pipeline: { label: "في الخط", color: "#d97706", bgColor: "#fffbeb" },
    won: { label: "مغلقة بنجاح", color: "#059669", bgColor: "#ecfdf5" },
    lost: { label: "خاسرة", color: "#dc2626", bgColor: "#fef2f2" },
  };

  const catMap = new Map<DealCategory, { count: number; totalSAR: number; weightedSAR: number }>();
  for (const d of riDeals) {
    const prev = catMap.get(d.category) ?? { count: 0, totalSAR: 0, weightedSAR: 0 };
    prev.count++;
    prev.totalSAR += d.valueSAR;
    prev.weightedSAR += Math.round((d.valueSAR * d.probabilityPct) / 100);
    catMap.set(d.category, prev);
  }

  const categoryOrder: DealCategory[] = ["commit", "best_case", "pipeline"];
  const categories: CategorySummary[] = categoryOrder
    .filter((c) => catMap.has(c))
    .map((c) => ({
      category: c,
      ...categoryMeta[c],
      ...(catMap.get(c) ?? { count: 0, totalSAR: 0, weightedSAR: 0 }),
    }));

  // Weekly history (last 12 weeks)
  const weekMap = new Map<string, WeeklySnapshot>();
  for (let i = 11; i >= 0; i--) {
    const ws = weekStart(new Date(now.getTime() - i * 7 * 86_400_000));
    const key = ws.toISOString().slice(0, 10);
    const label = ws.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
    weekMap.set(key, { weekLabel: label, weekStart: key, wonSAR: 0, lostSAR: 0, newPipelineSAR: 0, wonCount: 0 });
  }

  for (const d of wonDeals) {
    const key = d.updated_at ? weekKey(new Date(d.updated_at)) : null;
    if (!key || !weekMap.has(key)) continue;
    const s = weekMap.get(key)!;
    s.wonSAR += valueSAR(d.won_value_minor ?? d.expected_value_minor);
    s.wonCount++;
  }
  for (const d of lostDeals) {
    const key = d.updated_at ? weekKey(new Date(d.updated_at)) : null;
    if (!key || !weekMap.has(key)) continue;
    const s = weekMap.get(key)!;
    s.lostSAR += valueSAR(d.expected_value_minor);
  }
  for (const d of allDeals) {
    const key = d.created_at ? weekKey(new Date(d.created_at)) : null;
    if (!key || !weekMap.has(key)) continue;
    const s = weekMap.get(key)!;
    s.newPipelineSAR += valueSAR(d.expected_value_minor);
  }

  return {
    asOf: now.toISOString(),
    totalPipelineSAR,
    weightedPipelineSAR,
    wonThisMonthSAR,
    wonThisMonthCount: wonThisMonth.length,
    lostThisMonthCount: lostThisMonth.length,
    atRiskSAR,
    atRiskCount: atRiskDeals.length,
    forecast,
    categories,
    deals: riDeals.sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      return b.valueSAR - a.valueSAR;
    }),
    weeklyHistory: [...weekMap.values()],
    winRateThisMonth,
    avgDealSAR,
  };
}
