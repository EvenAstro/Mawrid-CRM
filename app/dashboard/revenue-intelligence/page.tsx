"use client";

import { useEffect, useState } from "react";
import {
  buildRevenueIntelligence,
  type RevenueIntelligenceData,
  type RIDeal,
  type DealCategory,
} from "@/lib/revenueIntelligence/buildRevenueIntelligence";

// ── Formatters ─────────────────────────────────────────────────────────────

function sarK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}م`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}ك`;
  return `${n}`;
}
function sarFull(n: number) {
  return n.toLocaleString("ar-SA");
}

// ── Color System ───────────────────────────────────────────────────────────

// Each category has a clear meaning + a color
const CAT_CONFIG: Record<string, {
  ar: string;
  explain: string;
  color: string;
  lightBg: string;
  border: string;
}> = {
  commit: {
    ar: "شبه مؤكدة",
    explain: "احتمالية فوق 80% ونشاط حديث",
    color: "#166534",
    lightBg: "#f0fdf4",
    border: "#86efac",
  },
  best_case: {
    ar: "محتملة",
    explain: "احتمالية 30–80%",
    color: "#1e40af",
    lightBg: "#eff6ff",
    border: "#93c5fd",
  },
  pipeline: {
    ar: "قيد المتابعة",
    explain: "احتمالية أقل من 30% أو بطيئة",
    color: "#92400e",
    lightBg: "#fffbeb",
    border: "#fcd34d",
  },
};

const RISK_CONFIG: Record<string, {
  ar: string;
  explain: string;
  color: string;
  lightBg: string;
  border: string;
  dot: string;
}> = {
  high: {
    ar: "خطر عالٍ",
    explain: "تحتاج تدخلاً فورياً",
    color: "#991b1b",
    lightBg: "#fff1f2",
    border: "#fca5a5",
    dot: "#ef4444",
  },
  medium: {
    ar: "خطر متوسط",
    explain: "تحتاج متابعة قريباً",
    color: "#92400e",
    lightBg: "#fffbeb",
    border: "#fde68a",
    dot: "#f59e0b",
  },
  low: {
    ar: "مستقرة",
    explain: "تسير بشكل طبيعي",
    color: "#14532d",
    lightBg: "#f0fdf4",
    border: "#86efac",
    dot: "#22c55e",
  },
};

// ── Simple Bar chart for forecast ─────────────────────────────────────────

function ForecastBars({ scenarios }: { scenarios: RevenueIntelligenceData["forecast"] }) {
  const max = Math.max(...scenarios.map((s) => s.valueSAR), 1);
  const colors = ["#166534", "#1a5c4f", "#2d8570"];
  return (
    <div className="space-y-5">
      {scenarios.map((s, i) => {
        const pct = Math.round((s.valueSAR / max) * 100);
        return (
          <div key={s.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: colors[i] }} />
                <span className="font-semibold text-gray-800">{s.label}</span>
              </div>
              <span className="font-black text-base" style={{ color: colors[i] }}>
                {sarFull(s.valueSAR)} <span className="text-xs font-normal text-gray-400">ر.س</span>
              </span>
            </div>
            <div className="relative h-3 w-full rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${pct}%`, backgroundColor: colors[i] }}
              />
            </div>
            <p className="text-xs text-gray-400">يشمل {s.dealCount} صفقة</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Horizontal bar for category distribution ───────────────────────────────

function StackedBar({ categories }: { categories: RevenueIntelligenceData["categories"] }) {
  const total = categories.reduce((s, c) => s + c.totalSAR, 0);
  if (!total) return null;
  return (
    <div className="space-y-1">
      {/* The bar */}
      <div className="flex h-4 w-full rounded-xl overflow-hidden gap-px">
        {categories.map((c) => {
          const cfg = CAT_CONFIG[c.category];
          const pct = (c.totalSAR / total) * 100;
          return (
            <div
              key={c.category}
              style={{ width: `${pct}%`, backgroundColor: cfg?.color ?? "#6b7280" }}
              title={`${cfg?.ar}: ${sarFull(c.totalSAR)} ر.س`}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {categories.map((c) => {
          const cfg = CAT_CONFIG[c.category];
          const pct = total ? Math.round((c.totalSAR / total) * 100) : 0;
          return (
            <div key={c.category} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm flex-none" style={{ backgroundColor: cfg?.color ?? "#6b7280" }} />
              <span className="text-xs text-gray-600 font-medium">{cfg?.ar}</span>
              <span className="text-xs text-gray-400">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Weekly bar chart ───────────────────────────────────────────────────────

function WeeklyChart({ data }: { data: RevenueIntelligenceData["weeklyHistory"] }) {
  const [hov, setHov] = useState<number | null>(null);
  const maxVal = Math.max(...data.map((w) => Math.max(w.wonSAR, w.lostSAR)), 1);

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-5 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-[#1a5c4f]" />
          <span className="text-xs text-gray-500 font-medium">صفقات مُغلقة (ربح)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-red-400" />
          <span className="text-xs text-gray-500 font-medium">صفقات خاسرة</span>
        </div>
      </div>
      {/* Bars */}
      <div className="flex items-end gap-1.5 h-36">
        {data.map((w, i) => (
          <div
            key={i}
            className="relative flex-1 flex flex-col items-center"
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            {/* Tooltip */}
            {hov === i && (
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20 bg-gray-900 text-white text-[11px] rounded-xl px-3 py-2 whitespace-nowrap shadow-xl pointer-events-none text-center">
                <p className="font-bold text-white/80 mb-0.5">{w.weekLabel}</p>
                <p className="text-green-300">ربح: {sarK(w.wonSAR)} ر.س</p>
                <p className="text-red-300">خسارة: {sarK(w.lostSAR)} ر.س</p>
                <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900" />
              </div>
            )}
            {/* Bar pair */}
            <div className="w-full flex items-end gap-0.5 h-32">
              <div
                className="flex-1 rounded-t-sm transition-all duration-500"
                style={{
                  height: `${(w.wonSAR / maxVal) * 100}%`,
                  backgroundColor: hov === i ? "#0d6e55" : "#1a5c4f",
                }}
              />
              <div
                className="flex-1 rounded-t-sm transition-all duration-500"
                style={{
                  height: `${(w.lostSAR / maxVal) * 100}%`,
                  backgroundColor: hov === i ? "#ef4444" : "#f87171",
                  opacity: 0.8,
                }}
              />
            </div>
            {/* X label */}
            {i % 3 === 0 && (
              <span className="text-[9px] text-gray-400 mt-1 whitespace-nowrap">{w.weekLabel}</span>
            )}
          </div>
        ))}
      </div>
      {/* Y axis hint */}
      <p className="text-[10px] text-gray-300 mt-2 text-left">كل عمود = أسبوع · حوّم للتفاصيل</p>
    </div>
  );
}

// ── Deal Modal ─────────────────────────────────────────────────────────────

function DealModal({ deal, onClose }: { deal: RIDeal; onClose: () => void }) {
  const cat = CAT_CONFIG[deal.category] ?? CAT_CONFIG.pipeline;
  const risk = RISK_CONFIG[deal.riskLevel];
  const weighted = Math.round((deal.valueSAR * deal.probabilityPct) / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top color stripe */}
        <div className="h-1.5" style={{ backgroundColor: risk.dot }} />

        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1">تفاصيل الصفقة</p>
            <h2 className="text-lg font-black text-gray-900">{deal.name}</h2>
            {deal.leadName && <p className="text-sm text-gray-400 mt-0.5">{deal.leadName}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 flex-none transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status badges */}
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          <span
            className="text-xs font-bold px-3 py-1 rounded-full border"
            style={{ color: cat.color, backgroundColor: cat.lightBg, borderColor: cat.border }}
          >
            {cat.ar} — {cat.explain}
          </span>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full border"
            style={{ color: risk.color, backgroundColor: risk.lightBg, borderColor: risk.border }}
          >
            {risk.ar} — {risk.explain}
          </span>
        </div>

        {/* Numbers */}
        <div className="mx-6 mb-5 grid grid-cols-3 gap-3">
          {[
            { label: "قيمة الصفقة", val: sarFull(deal.valueSAR), unit: "ر.س", note: "القيمة الكاملة المتوقعة" },
            { label: "احتمالية الإغلاق", val: `${deal.probabilityPct}%`, unit: "", note: "نسبة توقع الفوز" },
            { label: "القيمة المرجّحة", val: sarFull(weighted), unit: "ر.س", note: "القيمة × الاحتمالية", accent: true },
          ].map(({ label, val, unit, note, accent }) => (
            <div key={label} className="rounded-2xl bg-gray-50 p-3.5 text-center border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-base font-black ${accent ? "text-[#166534]" : "text-gray-900"}`}>
                {val} <span className="text-[10px] font-normal text-gray-400">{unit}</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">{note}</p>
            </div>
          ))}
        </div>

        {/* Timing */}
        <div className="mx-6 mb-5 rounded-2xl border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {[
            {
              label: "المرحلة الحالية",
              value: deal.stage,
              warn: false,
            },
            {
              label: "منذ آخر تحديث للمرحلة",
              value: `${deal.daysInStage} يوم`,
              warn: deal.daysInStage > 30,
              note: deal.daysInStage > 30 ? "طول مقلق" : undefined,
            },
            {
              label: "منذ آخر تواصل مع العميل",
              value: deal.daysSinceActivity !== null ? `${deal.daysSinceActivity} يوم` : "لا يوجد تواصل مسجّل",
              warn: deal.daysSinceActivity !== null && deal.daysSinceActivity > 14,
              note: deal.daysSinceActivity && deal.daysSinceActivity > 14 ? "يجب التواصل فوراً" : undefined,
            },
          ].map(({ label, value, warn, note }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 bg-white">
              <span className="text-sm text-gray-500">{label}</span>
              <div className="text-left">
                <span className={`text-sm font-bold ${warn ? "text-red-600" : "text-gray-800"}`}>{value}</span>
                {note && <span className="text-[10px] text-red-400 block">{note}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Risk reasons */}
        {deal.riskReasons.length > 0 && (
          <div
            className="mx-6 mb-5 rounded-2xl border p-4 space-y-2"
            style={{ backgroundColor: risk.lightBg, borderColor: risk.border }}
          >
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: risk.color }}>
              ⚠ إشارات الخطر المكتشفة
            </p>
            {deal.riskReasons.map((r) => (
              <div key={r} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ backgroundColor: risk.dot }} />
                <p className="text-sm" style={{ color: risk.color }}>{r}</p>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="px-6 pb-6">
          <a
            href="/dashboard/deals"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white text-sm font-bold transition hover:opacity-90 shadow"
            style={{ background: "linear-gradient(135deg,#0d3d33,#1a5c4f)" }}
          >
            افتح الصفقة في النظام
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Deal Table Row ─────────────────────────────────────────────────────────

function DealRow({ deal, onClick }: { deal: RIDeal; onClick: () => void }) {
  const cat = CAT_CONFIG[deal.category] ?? CAT_CONFIG.pipeline;
  const risk = RISK_CONFIG[deal.riskLevel];
  return (
    <tr
      onClick={onClick}
      className="border-b border-gray-50 hover:bg-[#f7fbf9] cursor-pointer transition-colors group"
    >
      {/* Risk dot + name */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full flex-none" style={{ backgroundColor: risk.dot }} title={risk.ar} />
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0d6e55] transition-colors">{deal.name}</p>
            {deal.leadName && <p className="text-[11px] text-gray-400">{deal.leadName}</p>}
          </div>
        </div>
      </td>

      {/* Stage */}
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          {deal.stageColor && (
            <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: deal.stageColor }} />
          )}
          <span className="text-xs text-gray-600">{deal.stage}</span>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap"
          style={{ color: cat.color, backgroundColor: cat.lightBg, borderColor: cat.border }}
        >
          {cat.ar}
        </span>
      </td>

      {/* Probability */}
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${deal.probabilityPct}%`, backgroundColor: cat.color }}
            />
          </div>
          <span className="text-xs font-bold text-gray-700">{deal.probabilityPct}%</span>
        </div>
      </td>

      {/* Last contact */}
      <td className="px-4 py-3.5 hidden xl:table-cell">
        {deal.daysSinceActivity !== null ? (
          <span className={`text-xs font-medium ${deal.daysSinceActivity > 14 ? "text-red-600" : "text-gray-500"}`}>
            منذ {deal.daysSinceActivity} يوم
          </span>
        ) : (
          <span className="text-xs text-gray-300">لا يوجد</span>
        )}
      </td>

      {/* Value */}
      <td className="px-5 py-3.5 text-left">
        <p className="text-sm font-black text-gray-900">{sarFull(deal.valueSAR)}</p>
        <p className="text-[10px] text-gray-400">ريال سعودي</p>
      </td>
    </tr>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label, note, value, valueColor, unit, iconBg, iconColor, icon,
}: {
  label: string; note: string; value: string; valueColor?: string;
  unit?: string; iconBg: string; iconColor: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{note}</p>
        </div>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-none" style={{ backgroundColor: iconBg }}>
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
      </div>
      <div className="flex items-end gap-1.5">
        <p className="text-3xl font-black leading-none" style={{ color: valueColor ?? "#111827" }}>{value}</p>
        {unit && <p className="text-sm text-gray-400 mb-0.5">{unit}</p>}
      </div>
    </div>
  );
}

// ── Section Wrapper ────────────────────────────────────────────────────────

function Section({
  title, subtitle, children, action,
}: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

type FilterKey = "all" | DealCategory | "high_risk";

export default function RevenueIntelligencePage() {
  const [data, setData] = useState<RevenueIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<RIDeal | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    buildRevenueIntelligence().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-[#1a5c4f]/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1a5c4f] animate-spin" />
        </div>
        <p className="text-gray-500 font-semibold">جارٍ تحليل بيانات المبيعات…</p>
      </div>
    );
  }

  if (!data) {
    return <div dir="rtl" className="py-20 text-center text-gray-400">تعذّر تحميل البيانات</div>;
  }

  const filteredDeals = data.deals.filter((d) => {
    if (filter === "high_risk" && d.riskLevel !== "high") return false;
    if (filter !== "all" && filter !== "high_risk" && d.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !(d.leadName ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const atRiskDeals = data.deals.filter((d) => d.riskLevel === "high");
  const filteredTotal = filteredDeals.reduce((s, d) => s + d.valueSAR, 0);
  const filteredWeighted = filteredDeals.reduce((s, d) => s + Math.round((d.valueSAR * d.probabilityPct) / 100), 0);

  const filterButtons: { key: FilterKey; label: string; count?: number }[] = [
    { key: "all", label: "كل الصفقات", count: data.deals.length },
    { key: "high_risk", label: "⚠ خطر عالٍ", count: data.atRiskCount },
    { key: "commit", label: "شبه مؤكدة" },
    { key: "best_case", label: "محتملة" },
    { key: "pipeline", label: "قيد المتابعة" },
  ];

  return (
    <div dir="rtl" className="space-y-6 pb-10">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl px-8 py-8 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#0a2e26 0%,#0d3d33 50%,#1a5c4f 100%)" }}
      >
        {/* Subtle pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 80% 20%, #ffffff 0%,transparent 60%)" }} />

        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
          {/* Title block */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/60 tracking-widest uppercase">تحليل مباشر</span>
            </div>
            <h1 className="text-3xl font-black">ذكاء الإيرادات</h1>
            <p className="text-white/50 text-sm mt-1">
              نظرة شاملة على خط مبيعاتك الحالي ومخاطره وتوقعاته
            </p>
          </div>

          {/* 3 top numbers */}
          <div className="flex flex-wrap gap-3">
            {[
              {
                label: "إجمالي خط المبيعات",
                note: "مجموع قيم الصفقات النشطة",
                value: sarK(data.totalPipelineSAR) + " ر.س",
              },
              {
                label: "الإيراد المرجّح",
                note: "بعد ضرب كل صفقة في احتماليتها",
                value: sarK(data.weightedPipelineSAR) + " ر.س",
              },
              {
                label: "مُغلق هذا الشهر",
                note: `${data.wonThisMonthCount} صفقة ناجحة حتى الآن`,
                value: sarK(data.wonThisMonthSAR) + " ر.س",
              },
            ].map(({ label, note, value }) => (
              <div
                key={label}
                className="rounded-2xl px-5 py-4 min-w-[150px]"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                <p className="text-[11px] text-white/55 font-medium mb-1">{label}</p>
                <p className="text-xl font-black">{value}</p>
                <p className="text-[11px] text-white/40 mt-1">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4 KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="صفقات تحتاج تدخلاً"
          note="لم يُتواصل معها 14+ يوم أو متعثرة"
          value={`${data.atRiskCount}`}
          valueColor="#dc2626"
          unit="صفقة"
          iconBg="#fff1f2"
          iconColor="#dc2626"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
        <StatCard
          label="نسبة الفوز هذا الشهر"
          note={`${data.wonThisMonthCount} ربح من أصل ${data.wonThisMonthCount + data.lostThisMonthCount} مُغلقة`}
          value={`${data.winRateThisMonth}%`}
          valueColor="#166534"
          iconBg="#f0fdf4"
          iconColor="#166534"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
        <StatCard
          label="متوسط قيمة الصفقة"
          note="للصفقات النشطة حالياً"
          value={sarK(data.avgDealSAR)}
          unit="ر.س"
          valueColor="#1e40af"
          iconBg="#eff6ff"
          iconColor="#1e40af"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/>
            </svg>
          }
        />
        <StatCard
          label="صفقات خُسرت هذا الشهر"
          note="تستحق مراجعة السبب"
          value={`${data.lostThisMonthCount}`}
          valueColor="#92400e"
          unit="صفقة"
          iconBg="#fffbeb"
          iconColor="#92400e"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          }
        />
      </div>

      {/* ── Middle row: Forecast + Category + Weekly ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Forecast */}
        <Section
          title="توقعات إيرادات هذا الشهر"
          subtitle="ثلاثة سيناريوهات محتملة بناءً على قيم الصفقات واحتمالياتها"
        >
          <ForecastBars scenarios={data.forecast} />
          <div className="mt-5 pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
            <p>• <strong className="text-gray-600">متحفظ:</strong> الصفقات شبه المؤكدة فقط</p>
            <p>• <strong className="text-gray-600">واقعي:</strong> جميع الصفقات × احتمالياتها</p>
            <p>• <strong className="text-gray-600">متفائل:</strong> كل الصفقات بقيمتها الكاملة</p>
            <p className="pt-1 text-[#166534] font-medium">✓ يشمل {sarFull(data.wonThisMonthSAR)} ر.س مُغلقة بالفعل</p>
          </div>
        </Section>

        {/* Category Distribution */}
        <Section
          title="توزيع خط المبيعات"
          subtitle="كيف تتوزع الصفقات حسب احتمالية الإغلاق"
        >
          <StackedBar categories={data.categories} />

          {/* Category details */}
          <div className="mt-6 space-y-3">
            {data.categories.map((c) => {
              const cfg = CAT_CONFIG[c.category];
              return (
                <div key={c.category} className="rounded-xl border p-3.5" style={{ borderColor: cfg?.border, backgroundColor: cfg?.lightBg }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: cfg?.color }} />
                      <span className="text-sm font-bold" style={{ color: cfg?.color }}>{cfg?.ar}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-700">{c.count} صفقة</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">{cfg?.explain}</p>
                  <p className="text-sm font-black" style={{ color: cfg?.color }}>{sarFull(c.totalSAR)} ر.س</p>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Weekly Chart */}
        <Section
          title="الأداء الأسبوعي"
          subtitle="آخر 12 أسبوع — مقارنة الصفقات المُغلقة بالخاسرة"
        >
          <WeeklyChart data={data.weeklyHistory} />
        </Section>
      </div>

      {/* ── At-Risk Alert ───────────────────────────────────────────────── */}
      {atRiskDeals.length > 0 && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-none">
              <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-red-900">
                تنبيه: {atRiskDeals.length} صفقة تحتاج تدخلاً فورياً
              </h2>
              <p className="text-xs text-red-600 mt-0.5">
                هذه الصفقات تُظهر إشارات خطر واضحة — إجمالي قيمتها {sarFull(data.atRiskSAR)} ر.س
              </p>
            </div>
          </div>

          {/* Risk cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {atRiskDeals.slice(0, 6).map((deal) => {
              const weighted = Math.round((deal.valueSAR * deal.probabilityPct) / 100);
              return (
                <button
                  key={deal.id}
                  onClick={() => setSelectedDeal(deal)}
                  className="text-right bg-white rounded-2xl border border-red-200 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{deal.name}</p>
                      {deal.leadName && <p className="text-[11px] text-gray-400 mt-0.5">{deal.leadName}</p>}
                    </div>
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full flex-none">
                      خطر عالٍ
                    </span>
                  </div>

                  {/* Risk reasons */}
                  <div className="space-y-1">
                    {deal.riskReasons.map((r) => (
                      <div key={r} className="flex items-start gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-none mt-1.5" />
                        <span className="text-[11px] text-red-700">{r}</span>
                      </div>
                    ))}
                  </div>

                  {/* Probability bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                      <span>احتمالية الإغلاق</span>
                      <span className="font-bold text-red-600">{deal.probabilityPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-red-100">
                      <div
                        className="h-full rounded-full bg-red-400 transition-all duration-700"
                        style={{ width: `${Math.max(4, deal.probabilityPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Value */}
                  <div className="flex items-center justify-between pt-2 border-t border-red-100 text-sm">
                    <div>
                      <p className="text-[10px] text-gray-400">القيمة الكاملة</p>
                      <p className="font-bold text-gray-900">{sarFull(deal.valueSAR)} ر.س</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-gray-400">المرجّح</p>
                      <p className="font-bold text-[#166534]">{sarFull(weighted)} ر.س</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Full Deals Table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-6 py-5 border-b border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">جميع الصفقات النشطة</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                انقر على أي صفقة لعرض تفاصيلها وأسباب خطرها
              </p>
            </div>
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن صفقة أو عميل…"
                className="border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/25 focus:border-[#1a5c4f] transition"
              />
            </div>
          </div>

          {/* Legend + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 ml-1">تصفية:</span>
            {filterButtons.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filter === key
                    ? "bg-[#1a5c4f] text-white border-[#1a5c4f] shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
              >
                {label}
                {count !== undefined && (
                  <span className="mr-1 opacity-70">({count})</span>
                )}
              </button>
            ))}
          </div>

          {/* Risk dot legend */}
          <div className="flex flex-wrap gap-4 pt-1">
            {Object.entries(RISK_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.dot }} />
                <span className="text-[11px] text-gray-500">{cfg.ar} — {cfg.explain}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                <th className="px-5 py-3 text-right">الصفقة</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">المرحلة</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">التصنيف</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">الاحتمالية</th>
                <th className="px-4 py-3 text-right hidden xl:table-cell">آخر تواصل</th>
                <th className="px-5 py-3 text-left">القيمة (ر.س)</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                    لا توجد صفقات مطابقة للفلتر
                  </td>
                </tr>
              ) : (
                filteredDeals.map((d) => (
                  <DealRow key={d.id} deal={d} onClick={() => setSelectedDeal(d)} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filteredDeals.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              <strong className="text-gray-700">{filteredDeals.length}</strong> صفقة ·
              إجمالي القيم: <strong className="text-gray-700">{sarFull(filteredTotal)} ر.س</strong>
            </p>
            <p className="text-xs text-gray-500">
              الإيراد المرجّح: <strong className="text-[#166534]">{sarFull(filteredWeighted)} ر.س</strong>
              <span className="text-gray-400 mr-1">(بعد تطبيق الاحتماليات)</span>
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedDeal && (
        <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
      )}
    </div>
  );
}
