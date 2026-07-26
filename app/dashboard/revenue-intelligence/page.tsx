"use client";

import { useEffect, useState, useRef } from "react";
import { buildRevenueIntelligence, type RevenueIntelligenceData, type RIDeal, type DealCategory } from "@/lib/revenueIntelligence/buildRevenueIntelligence";

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}ك`;
  return n.toString();
}
function fmtFull(n: number) {
  return n.toLocaleString("ar-SA");
}

const CATEGORY_META: Record<DealCategory | string, { label: string; dot: string; badge: string; text: string }> = {
  commit:    { label: "مؤكدة",        dot: "bg-[#1a5c4f]", badge: "bg-[#f0faf7] text-[#1a5c4f]", text: "text-[#1a5c4f]" },
  best_case: { label: "محتملة",       dot: "bg-blue-500",  badge: "bg-blue-50 text-blue-700",     text: "text-blue-700" },
  pipeline:  { label: "في الخط",     dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700",   text: "text-amber-700" },
  won:       { label: "مُغلقة بنجاح", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", text: "text-emerald-700" },
  lost:      { label: "خاسرة",        dot: "bg-red-500",   badge: "bg-red-50 text-red-700",       text: "text-red-700" },
};

const RISK_META = {
  high:   { label: "خطر عالٍ",    cls: "bg-red-50 text-red-600 border border-red-200",     dot: "bg-red-500" },
  medium: { label: "خطر متوسط",   cls: "bg-amber-50 text-amber-600 border border-amber-200", dot: "bg-amber-500" },
  low:    { label: "آمنة",         cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
};

// ── Mini SVG Area Chart ────────────────────────────────────────────────────

function AreaChart({ data, color = "#1a5c4f" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 280, h = 64, pad = 4;
  const pts = data.map((v, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * (w - 2 * pad),
    y: h - pad - ((v / max) * (h - 2 * pad)),
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = `${pathD} L${pts[pts.length - 1].x},${h - pad} L${pts[0].x},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace("#","")})`} />
      <path d={pathD} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} opacity="0.8" />
      ))}
    </svg>
  );
}

// ── Donut Chart ────────────────────────────────────────────────────────────

function DonutChart({ slices }: { slices: { value: number; color: string; label: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className="flex items-center justify-center h-full text-muted text-sm">لا توجد بيانات</div>;

  const r = 52, cx = 64, cy = 64, stroke = 24;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const segments = slices.map((s) => {
    const pct = s.value / total;
    const seg = { ...s, pct, dashArray: `${pct * circ} ${circ}`, dashOffset: -offset * circ };
    offset += pct;
    return seg;
  });

  return (
    <svg viewBox="0 0 128 128" className="w-full h-full">
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={stroke}
          strokeDasharray={seg.dashArray}
          strokeDashoffset={seg.dashOffset}
          transform="rotate(-90 64 64)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      ))}
      <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill="white" />
    </svg>
  );
}

// ── Bar Chart (weekly) ────────────────────────────────────────────────────

function WeeklyBarChart({ data }: { data: RevenueIntelligenceData["weeklyHistory"] }) {
  const maxVal = Math.max(...data.map((w) => Math.max(w.wonSAR, w.lostSAR)), 1);
  return (
    <div className="flex items-end gap-1 h-28 w-full">
      {data.map((w, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
            {w.weekLabel}<br />إغلاق: {fmt(w.wonSAR)} ر.س
          </div>
          <div className="w-full flex items-end gap-px h-24">
            <div
              className="flex-1 rounded-t-sm transition-all duration-500"
              style={{ height: `${(w.wonSAR / maxVal) * 100}%`, background: "#1a5c4f", opacity: 0.85 }}
            />
            <div
              className="flex-1 rounded-t-sm transition-all duration-500"
              style={{ height: `${(w.lostSAR / maxVal) * 100}%`, background: "#dc2626", opacity: 0.6 }}
            />
          </div>
          {i % 3 === 0 && <span className="text-[9px] text-muted whitespace-nowrap">{w.weekLabel}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Forecast Bar ───────────────────────────────────────────────────────────

function ForecastBar({ scenarios }: { scenarios: RevenueIntelligenceData["forecast"] }) {
  const max = Math.max(...scenarios.map((s) => s.valueSAR), 1);
  return (
    <div className="space-y-3">
      {scenarios.map((s) => (
        <div key={s.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">{s.label}</span>
            <span className="font-bold" style={{ color: s.color }}>{fmtFull(s.valueSAR)} ر.س</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(s.valueSAR / max) * 100}%`, backgroundColor: s.color }}
            />
          </div>
          <p className="text-xs text-muted">{s.dealCount} صفقة</p>
        </div>
      ))}
    </div>
  );
}

// ── Deal Row ───────────────────────────────────────────────────────────────

function DealRow({ deal, onClick }: { deal: RIDeal; onClick: () => void }) {
  const cat = CATEGORY_META[deal.category];
  const risk = RISK_META[deal.riskLevel];
  return (
    <button
      onClick={onClick}
      className="w-full text-right flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group"
    >
      {/* risk dot */}
      <div className={`h-2.5 w-2.5 flex-none rounded-full ${risk.dot}`} />

      {/* name + stage */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{deal.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {deal.stageColor && (
            <span className="inline-block h-1.5 w-1.5 rounded-full flex-none" style={{ backgroundColor: deal.stageColor }} />
          )}
          <span className="text-xs text-muted truncate">{deal.stage}</span>
          {deal.leadName && <span className="text-xs text-muted">· {deal.leadName}</span>}
        </div>
      </div>

      {/* activity */}
      <div className="text-center hidden md:block">
        <p className="text-xs text-muted">
          {deal.daysSinceActivity !== null ? `${deal.daysSinceActivity}ي` : "—"}
        </p>
        <p className="text-[10px] text-muted/60">آخر تواصل</p>
      </div>

      {/* prob */}
      <div className="text-center w-12 hidden sm:block">
        <p className="text-sm font-semibold text-ink">{deal.probabilityPct}%</p>
        <p className="text-[10px] text-muted">احتمال</p>
      </div>

      {/* category */}
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden lg:block ${cat.badge}`}>
        {cat.label}
      </span>

      {/* value */}
      <div className="text-left w-24 flex-none">
        <p className="text-sm font-bold text-ink">{fmtFull(deal.valueSAR)}</p>
        <p className="text-[10px] text-muted">ر.س</p>
      </div>
    </button>
  );
}

// ── Deal Detail Modal ──────────────────────────────────────────────────────

function DealModal({ deal, onClose }: { deal: RIDeal; onClose: () => void }) {
  const cat = CATEGORY_META[deal.category];
  const risk = RISK_META[deal.riskLevel];
  const weighted = Math.round((deal.valueSAR * deal.probabilityPct) / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-ink">{deal.name}</h3>
              {deal.leadName && <p className="text-sm text-muted mt-0.5">{deal.leadName}</p>}
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="px-6 py-5 space-y-4">
          {/* badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cat.badge}`}>{cat.label}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${risk.cls}`}>{risk.label}</span>
          </div>

          {/* numbers */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "القيمة", val: `${fmtFull(deal.valueSAR)} ر.س` },
              { label: "الاحتمالية", val: `${deal.probabilityPct}%` },
              { label: "المرجّح", val: `${fmtFull(weighted)} ر.س` },
            ].map(({ label, val }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted mb-1">{label}</p>
                <p className="text-sm font-bold text-ink">{val}</p>
              </div>
            ))}
          </div>

          {/* stage & timing */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-muted">المرحلة</span>
              <div className="flex items-center gap-1.5">
                {deal.stageColor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: deal.stageColor }} />}
                <span className="font-medium text-ink">{deal.stage}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-muted">أيام في المرحلة</span>
              <span className={`font-medium ${deal.daysInStage > 30 ? "text-amber-600" : "text-ink"}`}>
                {deal.daysInStage} يوم
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-muted">آخر تواصل</span>
              <span className={`font-medium ${deal.daysSinceActivity && deal.daysSinceActivity > 14 ? "text-red-600" : "text-ink"}`}>
                {deal.daysSinceActivity !== null ? `منذ ${deal.daysSinceActivity} يوم` : "لا يوجد"}
              </span>
            </div>
          </div>

          {/* risk reasons */}
          {deal.riskReasons.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">إشارات الخطر</p>
              {deal.riskReasons.map((r) => (
                <div key={r} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-red-500" />
                  <p className="text-sm text-red-700">{r}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 pb-5">
          <a
            href={`/dashboard/deals`}
            className="block w-full text-center bg-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition"
          >
            فتح الصفقة
          </a>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, trend, color = "#1a5c4f", icon,
}: {
  label: string; value: string; sub?: string; trend?: number; color?: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "18" }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-ink">{value}</p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          <svg viewBox="0 0 16 16" fill="currentColor" className={`h-3 w-3 ${trend < 0 ? "rotate-180" : ""}`}>
            <path d="M8 3l5 6H3z" />
          </svg>
          {Math.abs(trend)}% مقارنة بالشهر الماضي
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

type FilterType = "all" | DealCategory | "high_risk";

export default function RevenueIntelligencePage() {
  const [data, setData] = useState<RevenueIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<RIDeal | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    buildRevenueIntelligence()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-spin border-t-primary" />
        </div>
        <p className="text-muted text-sm">جارٍ تحليل خط الأنابيب…</p>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 text-muted">تعذّر تحميل البيانات</div>;

  // Filtered deals
  const filteredDeals = data.deals.filter((d) => {
    if (filter === "high_risk" && d.riskLevel !== "high") return false;
    if (filter !== "all" && filter !== "high_risk" && d.category !== filter) return false;
    if (search && !d.name.includes(search) && !(d.leadName || "").includes(search)) return false;
    return true;
  });

  const donutSlices = data.categories.map((c) => ({ value: c.totalSAR, color: c.color, label: c.label }));

  const filterButtons: { key: FilterType; label: string; count?: number }[] = [
    { key: "all", label: "الكل", count: data.deals.length },
    { key: "high_risk", label: "⚠ خطر عالٍ", count: data.atRiskCount },
    { key: "commit", label: "مؤكدة" },
    { key: "best_case", label: "محتملة" },
    { key: "pipeline", label: "في الخط" },
  ];

  return (
    <div className="space-y-8" dir="rtl">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0d3d33_0%,#1a5c4f_50%,#2d8570_100%)] px-8 py-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 80%, #ffffff 0%, transparent 60%), radial-gradient(circle at 80% 20%, #34a388 0%, transparent 50%)"
        }} />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
                  <path d="M3 3v18h18" />
                  <path d="m7 16 4-4 4 4 4-4" />
                </svg>
              </div>
              <span className="text-white/70 text-sm font-medium uppercase tracking-widest">ذكاء الإيرادات</span>
            </div>
            <h1 className="text-3xl font-black">خط الأنابيب المباشر</h1>
            <p className="text-white/70 mt-1 text-sm">
              تحديث تلقائي · {new Date(data.asOf).toLocaleString("ar-SA", { weekday: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex gap-4">
            {[
              { label: "إجمالي الخط", value: `${fmt(data.totalPipelineSAR)} ر.س`, sub: `${data.deals.length} صفقة` },
              { label: "الإيراد المرجّح", value: `${fmt(data.weightedPipelineSAR)} ر.س`, sub: "بالاحتمالية" },
              { label: "أُغلق هذا الشهر", value: `${fmt(data.wonThisMonthSAR)} ر.س`, sub: `${data.wonThisMonthCount} صفقة` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 min-w-[120px] border border-white/10">
                <p className="text-white/60 text-xs mb-1">{label}</p>
                <p className="text-xl font-black">{value}</p>
                <p className="text-white/50 text-xs mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="في خطر عالٍ"
          value={`${data.atRiskCount} صفقة`}
          sub={`${fmtFull(data.atRiskSAR)} ر.س معرّضة للخسارة`}
          color="#dc2626"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        <KpiCard
          label="نسبة الفوز"
          value={`${data.winRateThisMonth}%`}
          sub="هذا الشهر"
          color="#1a5c4f"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><polyline points="20 6 9 17 4 12"/></svg>}
        />
        <KpiCard
          label="متوسط الصفقة"
          value={`${fmt(data.avgDealSAR)} ر.س`}
          sub="للصفقة النشطة"
          color="#2563eb"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
        />
        <KpiCard
          label="خسائر الشهر"
          value={`${data.lostThisMonthCount} صفقة`}
          sub="تحتاج مراجعة"
          color="#d97706"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
        />
      </div>

      {/* ── Middle Row: Forecast + Donut + Weekly ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Forecast */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1a5c4f" strokeWidth={2} className="h-4 w-4">
                <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">توقعات الإيرادات</h3>
              <p className="text-xs text-muted">ثلاثة سيناريوهات</p>
            </div>
          </div>
          <ForecastBar scenarios={data.forecast} />
          <div className="bg-primary/5 rounded-xl p-3 text-xs text-primary font-medium text-center">
            يشمل {fmtFull(data.wonThisMonthSAR)} ر.س مُغلقة هذا الشهر
          </div>
        </div>

        {/* Donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={2} className="h-4 w-4">
                <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">توزيع الخط</h3>
              <p className="text-xs text-muted">حسب التصنيف</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-28 w-28 flex-none">
              <DonutChart slices={donutSlices} />
            </div>
            <div className="flex-1 space-y-2">
              {data.categories.map((c) => (
                <div key={c.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-xs text-muted">{c.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-ink">{fmt(c.totalSAR)}</span>
                    <span className="text-[10px] text-muted mr-0.5">ر.س</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Weekly History */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2} className="h-4 w-4">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">الإغلاق الأسبوعي</h3>
              <p className="text-xs text-muted">آخر 12 أسبوع</p>
            </div>
          </div>
          <WeeklyBarChart data={data.weeklyHistory} />
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#1a5c4f]" /><span className="text-[10px] text-muted">مُغلقة</span></div>
            <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-400" /><span className="text-[10px] text-muted">خاسرة</span></div>
          </div>
        </div>
      </div>

      {/* ── Deal Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-ink">جميع الصفقات النشطة</h3>
              <p className="text-xs text-muted mt-0.5">مرتبة حسب الخطر ثم القيمة</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                  <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث…"
                  className="border border-gray-200 rounded-xl pr-9 pl-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {filterButtons.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  filter === key
                    ? "bg-primary text-white shadow-sm"
                    : "bg-gray-100 text-muted hover:bg-gray-200"
                }`}
              >
                {label}{count !== undefined && <span className="mr-1 opacity-70">({count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Table header row */}
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[11px] text-muted font-medium uppercase tracking-wide">
          <div className="w-2.5 flex-none" />
          <div className="flex-1">الصفقة</div>
          <div className="w-16 text-center hidden md:block">آخر تواصل</div>
          <div className="w-12 text-center hidden sm:block">الاحتمال</div>
          <div className="w-20 hidden lg:block">التصنيف</div>
          <div className="w-24 text-left">القيمة</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {filteredDeals.length === 0 ? (
            <div className="py-16 text-center text-muted text-sm">لا توجد صفقات مطابقة</div>
          ) : (
            filteredDeals.map((deal) => (
              <DealRow key={deal.id} deal={deal} onClick={() => setSelectedDeal(deal)} />
            ))
          )}
        </div>

        {/* Footer */}
        {filteredDeals.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-muted">{filteredDeals.length} صفقة · إجمالي {fmtFull(filteredDeals.reduce((s, d) => s + d.valueSAR, 0))} ر.س</p>
            <p className="text-xs text-muted">مرجّح: {fmtFull(filteredDeals.reduce((s, d) => s + Math.round(d.valueSAR * d.probabilityPct / 100), 0))} ر.س</p>
          </div>
        )}
      </div>

      {/* ── Deal Modal ── */}
      {selectedDeal && <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />}
    </div>
  );
}
