"use client";

import { useEffect, useState } from "react";
import {
  buildRevenueIntelligence,
  type RevenueIntelligenceData,
  type RIDeal,
  type DealCategory,
} from "@/lib/revenueIntelligence/buildRevenueIntelligence";

// ── Formatters ─────────────────────────────────────────────────────────────

function sarCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} م`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} ك`;
  return n.toString();
}
function sarFull(n: number) {
  return n.toLocaleString("ar-SA");
}

// ── Metadata ───────────────────────────────────────────────────────────────

const CAT: Record<string, { ar: string; color: string; bg: string; border: string; ring: string }> = {
  commit:    { ar: "شبه مؤكدة",   color: "#0d6e55", bg: "#edfaf5", border: "#a7e8d5", ring: "#0d6e55" },
  best_case: { ar: "محتملة",      color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", ring: "#1d4ed8" },
  pipeline:  { ar: "قيد المتابعة", color: "#b45309", bg: "#fffbeb", border: "#fcd34d", ring: "#b45309" },
};

const RISK: Record<string, { ar: string; color: string; bg: string; border: string; barColor: string }> = {
  high:   { ar: "عالي الخطورة",  color: "#dc2626", bg: "#fef2f2", border: "#fecaca", barColor: "#ef4444" },
  medium: { ar: "متوسط الخطورة", color: "#d97706", bg: "#fffbeb", border: "#fde68a", barColor: "#f59e0b" },
  low:    { ar: "مستقر",          color: "#059669", bg: "#ecfdf5", border: "#a7f3d0", barColor: "#10b981" },
};

// ── SVG Icons ──────────────────────────────────────────────────────────────

const Icon = {
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>
    </svg>
  ),
  coin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  pipeline: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M3 12h4l2.5-7 5 14L17 12h4"/>
    </svg>
  ),
};

// ── Donut Chart ────────────────────────────────────────────────────────────

function Donut({ slices, total }: { slices: { value: number; color: string }[]; total: number }) {
  const r = 44, cx = 56, cy = 56, stroke = 20, circ = 2 * Math.PI * r;
  let offset = 0;
  const segs = slices.map((s) => {
    const pct = total ? s.value / total : 0;
    const seg = { ...s, pct, da: `${pct * circ} ${circ}`, do: -(offset * circ) };
    offset += pct;
    return seg;
  });
  return (
    <svg viewBox="0 0 112 112" className="w-full h-full">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      {segs.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
          strokeDasharray={s.da} strokeDashoffset={s.do} transform="rotate(-90 56 56)"
          style={{ transition: "stroke-dasharray 1s ease" }} />
      ))}
      <circle cx={cx} cy={cy} r={r - stroke / 2 - 2} fill="white" />
    </svg>
  );
}

// ── Weekly Bars ────────────────────────────────────────────────────────────

function WeeklyBars({ data }: { data: RevenueIntelligenceData["weeklyHistory"] }) {
  const [hov, setHov] = useState<number | null>(null);
  const maxVal = Math.max(...data.map((w) => Math.max(w.wonSAR, w.lostSAR)), 1);
  return (
    <div className="flex items-end gap-[3px] h-32 w-full">
      {data.map((w, i) => (
        <div key={i} className="relative flex-1 flex flex-col items-center gap-px"
          onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
          {hov === i && (
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-20 bg-[#0d1f1a] text-white text-[11px] rounded-xl px-3 py-2 whitespace-nowrap shadow-xl pointer-events-none">
              <p className="font-bold">{w.weekLabel}</p>
              <p className="text-emerald-300">مُغلق: {sarCompact(w.wonSAR)} ر.س</p>
              <p className="text-red-300">خسائر: {sarCompact(w.lostSAR)} ر.س</p>
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0" style={{ borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #0d1f1a" }} />
            </div>
          )}
          <div className="w-full flex items-end gap-px h-28">
            <div className="flex-1 rounded-t-[3px] transition-all duration-500"
              style={{ height: `${(w.wonSAR / maxVal) * 100}%`, backgroundColor: hov === i ? "#059669" : "#1a5c4f", opacity: 0.9 }} />
            <div className="flex-1 rounded-t-[3px] transition-all duration-500"
              style={{ height: `${(w.lostSAR / maxVal) * 100}%`, backgroundColor: hov === i ? "#ef4444" : "#dc2626", opacity: 0.6 }} />
          </div>
          {i % 4 === 0 && <span className="text-[9px] text-gray-400 mt-1 whitespace-nowrap">{w.weekLabel}</span>}
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, iconBg, icon, accent = "#1a5c4f" }:
  { label: string; value: string; sub?: string; iconBg: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="group bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-gray-500 leading-tight">{label}</p>
        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-none" style={{ backgroundColor: iconBg }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-[26px] font-black tracking-tight leading-none" style={{ color: accent }}>{value}</p>
        {sub && <p className="text-[12px] text-gray-400 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Deal Card (for at-risk section) ───────────────────────────────────────

function RiskCard({ deal, onClick }: { deal: RIDeal; onClick: () => void }) {
  const risk = RISK[deal.riskLevel];
  const weighted = Math.round((deal.valueSAR * deal.probabilityPct) / 100);
  const probWidth = Math.max(4, deal.probabilityPct);

  return (
    <button onClick={onClick}
      className="w-full text-right bg-white border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 space-y-3"
      style={{ borderColor: risk.border }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-sm truncate">{deal.name}</p>
          {deal.leadName && <p className="text-[12px] text-gray-400 mt-0.5">{deal.leadName}</p>}
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-none whitespace-nowrap"
          style={{ color: risk.color, backgroundColor: risk.bg, border: `1px solid ${risk.border}` }}>
          {risk.ar}
        </span>
      </div>

      {/* Reasons */}
      {deal.riskReasons.length > 0 && (
        <div className="space-y-1">
          {deal.riskReasons.map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ backgroundColor: risk.barColor }} />
              <span className="text-[11px] text-gray-500">{r}</span>
            </div>
          ))}
        </div>
      )}

      {/* Probability bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>احتمالية الإغلاق</span>
          <span className="font-bold" style={{ color: risk.color }}>{deal.probabilityPct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${probWidth}%`, backgroundColor: risk.barColor }} />
        </div>
      </div>

      {/* Value */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <div>
          <p className="text-[11px] text-gray-400">القيمة</p>
          <p className="text-sm font-bold text-gray-900">{sarFull(deal.valueSAR)} <span className="text-[11px] font-normal text-gray-400">ر.س</span></p>
        </div>
        <div className="text-left">
          <p className="text-[11px] text-gray-400">المرجّح</p>
          <p className="text-sm font-bold" style={{ color: "#1a5c4f" }}>{sarFull(weighted)} <span className="text-[11px] font-normal text-gray-400">ر.س</span></p>
        </div>
      </div>
    </button>
  );
}

// ── Deal Table Row ─────────────────────────────────────────────────────────

function TableRow({ deal, onClick }: { deal: RIDeal; onClick: () => void }) {
  const cat = CAT[deal.category] ?? CAT.pipeline;
  const risk = RISK[deal.riskLevel];
  return (
    <tr onClick={onClick} className="group border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: risk.barColor }} />
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0d6e55] transition-colors">{deal.name}</p>
            {deal.leadName && <p className="text-[11px] text-gray-400">{deal.leadName}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          {deal.stageColor && <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: deal.stageColor }} />}
          <span className="text-[12px] text-gray-600">{deal.stage}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ color: cat.color, backgroundColor: cat.bg, border: `1px solid ${cat.border}` }}>
          {cat.ar}
        </span>
      </td>
      <td className="px-4 py-3.5 hidden sm:table-cell">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${deal.probabilityPct}%`, backgroundColor: cat.color }} />
          </div>
          <span className="text-[12px] font-bold text-gray-700">{deal.probabilityPct}%</span>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        {deal.daysSinceActivity !== null ? (
          <span className={`text-[12px] font-medium ${deal.daysSinceActivity > 14 ? "text-red-600" : "text-gray-500"}`}>
            {deal.daysSinceActivity} يوم
          </span>
        ) : <span className="text-[11px] text-gray-300">—</span>}
      </td>
      <td className="px-5 py-3.5 text-left">
        <p className="text-sm font-bold text-gray-900">{sarFull(deal.valueSAR)}</p>
        <p className="text-[10px] text-gray-400">ر.س</p>
      </td>
    </tr>
  );
}

// ── Deal Detail Modal ──────────────────────────────────────────────────────

function DealModal({ deal, onClose }: { deal: RIDeal; onClose: () => void }) {
  const cat = CAT[deal.category] ?? CAT.pipeline;
  const risk = RISK[deal.riskLevel];
  const weighted = Math.round((deal.valueSAR * deal.probabilityPct) / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Colored top bar */}
        <div className="h-1.5 w-full" style={{ backgroundColor: risk.barColor }} />

        {/* Header */}
        <div className="px-7 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900">{deal.name}</h2>
            {deal.leadName && <p className="text-sm text-gray-400 mt-1">{deal.leadName}</p>}
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 flex-none transition-colors">
            {Icon.close}
          </button>
        </div>

        {/* Badges */}
        <div className="px-7 pb-4 flex flex-wrap gap-2">
          <span className="text-[12px] font-bold px-3 py-1 rounded-full"
            style={{ color: cat.color, backgroundColor: cat.bg, border: `1px solid ${cat.border}` }}>{cat.ar}</span>
          <span className="text-[12px] font-bold px-3 py-1 rounded-full"
            style={{ color: risk.color, backgroundColor: risk.bg, border: `1px solid ${risk.border}` }}>{risk.ar}</span>
          <span className="text-[12px] font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">{deal.stage}</span>
        </div>

        {/* Numbers grid */}
        <div className="mx-7 mb-5 grid grid-cols-3 gap-3">
          {[
            { label: "القيمة الكاملة", val: `${sarFull(deal.valueSAR)}`, unit: "ر.س" },
            { label: "احتمالية الإغلاق", val: `${deal.probabilityPct}%`, unit: "" },
            { label: "القيمة المرجّحة", val: `${sarFull(weighted)}`, unit: "ر.س", accent: true },
          ].map(({ label, val, unit, accent }) => (
            <div key={label} className="bg-gray-50 rounded-2xl p-3.5 text-center">
              <p className="text-[11px] text-gray-400 mb-1">{label}</p>
              <p className={`text-base font-black ${accent ? "text-[#0d6e55]" : "text-gray-900"}`}>{val}</p>
              {unit && <p className="text-[10px] text-gray-400">{unit}</p>}
            </div>
          ))}
        </div>

        {/* Timing info */}
        <div className="mx-7 mb-5 space-y-0 rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
          {[
            {
              icon: Icon.clock,
              label: "أيام في المرحلة الحالية",
              val: `${deal.daysInStage} يوم`,
              warn: deal.daysInStage > 30,
            },
            {
              icon: Icon.activity,
              label: "آخر تواصل مع العميل",
              val: deal.daysSinceActivity !== null ? `منذ ${deal.daysSinceActivity} يوم` : "لا يوجد تواصل مسجّل",
              warn: deal.daysSinceActivity !== null && deal.daysSinceActivity > 14,
            },
          ].map(({ icon, label, val, warn }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 bg-white">
              <span className="text-gray-400 flex-none">{icon}</span>
              <span className="flex-1 text-[13px] text-gray-500">{label}</span>
              <span className={`text-[13px] font-bold ${warn ? "text-red-600" : "text-gray-800"}`}>{val}</span>
            </div>
          ))}
        </div>

        {/* Risk reasons */}
        {deal.riskReasons.length > 0 && (
          <div className="mx-7 mb-5 rounded-2xl overflow-hidden" style={{ backgroundColor: risk.bg, border: `1px solid ${risk.border}` }}>
            <div className="px-4 pt-3.5 pb-1">
              <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: risk.color }}>
                إشارات الخطر المكتشفة
              </p>
            </div>
            {deal.riskReasons.map((r) => (
              <div key={r} className="flex items-center gap-2.5 px-4 py-2 border-t" style={{ borderColor: risk.border }}>
                <span className="h-2 w-2 rounded-full flex-none" style={{ backgroundColor: risk.barColor }} />
                <p className="text-[13px]" style={{ color: risk.color }}>{r}</p>
              </div>
            ))}
            <div className="pb-3" />
          </div>
        )}

        {/* CTA */}
        <div className="px-7 pb-7">
          <a href="/dashboard/deals"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-white text-sm font-bold transition-all hover:opacity-90 shadow-lg"
            style={{ background: "linear-gradient(135deg, #0d3d33, #1a5c4f)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="m9 18 6-6-6-6"/>
            </svg>
            الانتقال إلى الصفقة
          </a>
        </div>
      </div>
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
  const [activeTab, setActiveTab] = useState<"all" | "risk">("all");

  useEffect(() => {
    buildRevenueIntelligence().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-5" dir="rtl">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-4 border-[#1a5c4f]/15" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#1a5c4f] animate-spin" />
          <div className="absolute inset-3 rounded-full border-2 border-transparent border-t-[#34a388] animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.7s" }} />
        </div>
        <div className="text-center">
          <p className="text-gray-700 font-bold text-lg">جارٍ تحليل خط المبيعات</p>
          <p className="text-gray-400 text-sm mt-1">نحلّل الصفقات ونحسب التوقعات…</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 text-gray-400" dir="rtl">تعذّر تحميل البيانات</div>;

  const filteredDeals = data.deals.filter((d) => {
    if (filter === "high_risk" && d.riskLevel !== "high") return false;
    if (filter !== "all" && filter !== "high_risk" && d.category !== filter) return false;
    if (search && !d.name.includes(search) && !(d.leadName || "").includes(search)) return false;
    return true;
  });

  const atRiskDeals = data.deals.filter((d) => d.riskLevel === "high");
  const donutSlices = data.categories.map((c) => ({ value: c.totalSAR, color: c.color }));

  const maxForecast = Math.max(...data.forecast.map((f) => f.valueSAR), 1);

  return (
    <div dir="rtl" className="space-y-7 pb-10">

      {/* ── Hero Banner ───────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl text-white"
        style={{ background: "linear-gradient(135deg, #091f1a 0%, #0d3d33 45%, #1a5c4f 80%, #2d8570 100%)" }}>
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #34a388, transparent)" }} />
          <div className="absolute -bottom-10 right-1/3 h-48 w-48 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #ffffff, transparent)" }} />
        </div>

        <div className="relative px-8 py-7">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            {/* Title */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-4 py-1.5 mb-4">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[12px] font-semibold text-white/80 tracking-wider uppercase">مباشر · تحديث فوري</span>
              </div>
              <h1 className="text-4xl font-black leading-tight">ذكاء الإيرادات</h1>
              <p className="text-white/60 mt-2 text-sm">
                {new Date(data.asOf).toLocaleString("ar-SA", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            {/* Big numbers */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: "إجمالي خط المبيعات", value: sarCompact(data.totalPipelineSAR) + " ر.س", sub: `${data.deals.length} صفقة نشطة`, accent: true },
                { label: "الإيراد المرجّح", value: sarCompact(data.weightedPipelineSAR) + " ر.س", sub: "بعد تطبيق الاحتمالية" },
                { label: "أُغلق هذا الشهر", value: sarCompact(data.wonThisMonthSAR) + " ر.س", sub: `${data.wonThisMonthCount} صفقة ناجحة` },
              ].map(({ label, value, sub, accent }) => (
                <div key={label}
                  className="rounded-2xl px-6 py-4 min-w-[155px] border"
                  style={{
                    background: accent ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.07)",
                    borderColor: accent ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                  }}>
                  <p className="text-white/55 text-[11px] font-medium mb-1">{label}</p>
                  <p className="text-2xl font-black">{value}</p>
                  <p className="text-white/45 text-[11px] mt-1">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="صفقات في خطر عالٍ"
          value={`${data.atRiskCount} صفقة`}
          sub={`${sarFull(data.atRiskSAR)} ر.س قد تُخسر`}
          iconBg="#fef2f2" accent="#dc2626"
          icon={Icon.alert}
        />
        <KpiCard
          label="نسبة الفوز هذا الشهر"
          value={`${data.winRateThisMonth}%`}
          sub={`${data.wonThisMonthCount} فوز · ${data.lostThisMonthCount} خسارة`}
          iconBg="#ecfdf5" accent="#059669"
          icon={Icon.check}
        />
        <KpiCard
          label="متوسط قيمة الصفقة"
          value={`${sarCompact(data.avgDealSAR)} ر.س`}
          sub="للصفقات النشطة"
          iconBg="#eff6ff" accent="#1d4ed8"
          icon={Icon.coin}
        />
        <KpiCard
          label="إجمالي الخط النشط"
          value={`${sarCompact(data.totalPipelineSAR)} ر.س`}
          sub={`${data.deals.length} صفقة في المسار`}
          iconBg="#f0fdf4" accent="#0d6e55"
          icon={Icon.pipeline}
        />
      </div>

      {/* ── Middle Row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Forecast */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0d3d33,#1a5c4f)" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M3 3v18h18"/><path d="m7 16 4-4 4 4 4-4"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">توقعات الإيرادات</h3>
              <p className="text-[12px] text-gray-400">ثلاثة سيناريوهات محتملة</p>
            </div>
          </div>

          <div className="space-y-4">
            {data.forecast.map((s) => (
              <div key={s.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[13px] font-semibold text-gray-700">{s.label}</span>
                  </div>
                  <span className="text-sm font-black" style={{ color: s.color }}>{sarCompact(s.valueSAR)} ر.س</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${(s.valueSAR / maxForecast) * 100}%`, backgroundColor: s.color }} />
                </div>
                <p className="text-[11px] text-gray-400">{s.dealCount} صفقة · {sarFull(s.valueSAR)} ر.س</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl px-4 py-3 text-center" style={{ background: "#f0faf7" }}>
            <p className="text-[12px] font-bold text-[#0d6e55]">يشمل {sarFull(data.wonThisMonthSAR)} ر.س مُغلقة بالفعل هذا الشهر</p>
          </div>
        </div>

        {/* Pipeline Distribution */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-blue-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">توزيع خط المبيعات</h3>
              <p className="text-[12px] text-gray-400">حسب تصنيف الصفقة</p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="h-32 w-32 flex-none">
              <Donut slices={donutSlices} total={data.totalPipelineSAR} />
            </div>
            <div className="flex-1 space-y-2.5">
              {data.categories.map((c) => {
                const pct = data.totalPipelineSAR ? Math.round((c.totalSAR / data.totalPipelineSAR) * 100) : 0;
                const meta = CAT[c.category] ?? CAT.pipeline;
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-[12px] text-gray-600 font-medium">{meta.ar}</span>
                      </div>
                      <span className="text-[12px] font-bold" style={{ color: c.color }}>{pct}%</span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-gray-100">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{c.count} صفقة · {sarFull(c.totalSAR)} ر.س</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Weekly History */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-amber-50">
              <svg viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">الأداء الأسبوعي</h3>
              <p className="text-[12px] text-gray-400">آخر 12 أسبوع</p>
            </div>
          </div>
          <WeeklyBars data={data.weeklyHistory} />
          <div className="flex items-center gap-5 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#1a5c4f" }} />
              <span className="text-[11px] text-gray-500">مُغلق بنجاح</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#dc2626", opacity: 0.6 }} />
              <span className="text-[11px] text-gray-500">خسائر</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── At-Risk Section ───────────────────────────────────────────────── */}
      {atRiskDeals.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-red-50">
              <span className="text-red-500">{Icon.alert}</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">صفقات في خطر عالٍ</h2>
              <p className="text-[12px] text-gray-400">تحتاج تدخلاً فورياً</p>
            </div>
            <span className="mr-auto text-[12px] font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
              {atRiskDeals.length} صفقة · {sarFull(data.atRiskSAR)} ر.س
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {atRiskDeals.slice(0, 6).map((d) => (
              <RiskCard key={d.id} deal={d} onClick={() => setSelectedDeal(d)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Full Deals Table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Table toolbar */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">جميع الصفقات النشطة</h3>
              <p className="text-[12px] text-gray-400 mt-0.5">مرتبة حسب مستوى الخطر ثم القيمة</p>
            </div>
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{Icon.search}</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن صفقة أو عميل…"
                className="border border-gray-200 rounded-xl pr-9 pl-4 py-2.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/25 focus:border-[#1a5c4f] transition-all"
              />
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { key: "all" as FilterType,       label: "الكل",             count: data.deals.length },
              { key: "high_risk" as FilterType, label: "⚠️ خطر عالٍ",     count: data.atRiskCount },
              { key: "commit" as FilterType,    label: "شبه مؤكدة" },
              { key: "best_case" as FilterType, label: "محتملة" },
              { key: "pipeline" as FilterType,  label: "قيد المتابعة" },
            ].map(({ key, label, count }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 ${
                  filter === key
                    ? "bg-[#1a5c4f] text-white shadow-sm"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                {label}
                {count !== undefined && <span className="mr-1.5 opacity-70">({count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  { label: "الصفقة والعميل", cls: "px-5 py-3 text-right" },
                  { label: "المرحلة", cls: "px-4 py-3 text-right" },
                  { label: "التصنيف", cls: "px-4 py-3 text-right hidden md:table-cell" },
                  { label: "الاحتمالية", cls: "px-4 py-3 text-right hidden sm:table-cell" },
                  { label: "آخر تواصل", cls: "px-4 py-3 text-right hidden lg:table-cell" },
                  { label: "القيمة", cls: "px-5 py-3 text-left" },
                ].map((h) => (
                  <th key={h.label} className={`${h.cls} text-[11px] font-bold text-gray-400 uppercase tracking-wider`}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDeals.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-gray-400 text-sm">لا توجد صفقات مطابقة</td></tr>
              ) : (
                filteredDeals.map((d) => <TableRow key={d.id} deal={d} onClick={() => setSelectedDeal(d)} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {filteredDeals.length > 0 && (
          <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[12px] text-gray-400">
            <span>{filteredDeals.length} صفقة · إجمالي <strong className="text-gray-700">{sarFull(filteredDeals.reduce((s, d) => s + d.valueSAR, 0))} ر.س</strong></span>
            <span>المرجّح الإجمالي: <strong className="text-[#0d6e55]">{sarFull(filteredDeals.reduce((s, d) => s + Math.round((d.valueSAR * d.probabilityPct) / 100), 0))} ر.س</strong></span>
          </div>
        )}
      </div>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {selectedDeal && <DealModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />}
    </div>
  );
}
