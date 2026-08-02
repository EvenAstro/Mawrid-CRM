"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildInsights, type InsightsData, type DateRangeKey, type CustomRange } from "@/lib/insights/buildInsights";
import { money } from "@/lib/format";
import RichText from "@/components/copilot/RichText";
import Skeleton from "@/components/ui/Skeleton";

const CARD = "rounded-2xl border border-gray-100 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)]";
const RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "7d", label: "7 أيام" },
  { key: "30d", label: "30 يوم" },
  { key: "90d", label: "90 يوم" },
  { key: "year", label: "هذي السنة" },
  { key: "all", label: "الكل" },
];

const PALETTE = ["#1a5c4f", "#2d8570", "#f59e0b", "#6366f1", "#ef4444", "#0ea5e9", "#a855f7", "#10b981", "#ec4899", "#14b8a6"];

function sar(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(Math.round(n));
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- KPI card ---------- */
function Kpi({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#e8efed] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.05),0_12px_32px_rgba(0,0,0,0.03)]">
      <span className="absolute bottom-3 left-0 top-3 w-1 rounded-full" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <p dir="auto" className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</p>
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl transition-transform group-hover:scale-105" style={{ background: `${color}1a`, color }}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-[26px] font-black leading-none tabular-nums text-[#1e1b4b]">{value}</p>
      {sub && <p dir="auto" className="mt-1.5 text-[12px] font-medium text-[#94a3b8]">{sub}</p>}
    </div>
  );
}

/* ---------- Trend chart ---------- */
function TrendChart({ trend }: { trend: InsightsData["trend"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 220, padL = 16, padR = 16, padT = 20, padB = 32;
  const maxVal = Math.max(1, ...trend.map((p) => p.pipelineValueSAR));
  const stepX = trend.length > 1 ? (W - padL - padR) / (trend.length - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => H - padB - (v / maxVal) * (H - padT - padB);
  const coords = trend.map((p, i) => ({ x: x(i), y: y(p.pipelineValueSAR) }));
  const line = coords.reduce((d, c, i) => {
    if (i === 0) return `M ${c.x} ${c.y}`;
    const prev = coords[i - 1];
    const cx = (prev.x + c.x) / 2;
    return `${d} C ${cx} ${prev.y}, ${cx} ${c.y}, ${c.x} ${c.y}`;
  }, "");
  const area = coords.length ? `${line} L ${coords[coords.length - 1].x} ${H - padB} L ${coords[0].x} ${H - padB} Z` : "";
  const everyN = Math.ceil(trend.length / 8) || 1;
  const allZero = trend.every((t) => t.pipelineValueSAR === 0);

  if (allZero) {
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0faf8] text-2xl">📊</div>
        <p dir="auto" className="text-[14px] text-[#94a3b8]">لا توجد بيانات لعرضها بهذي الفترة</p>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="insightsAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5c4f" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#1a5c4f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={padL} x2={W - padR} y1={y(maxVal * g)} y2={y(maxVal * g)} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      {[0, 0.5, 1].map((g) => (
        <text key={`y${g}`} x={4} y={y(maxVal * g) + 3} fontSize="9" fill="#cbd5e1">
          {sar(maxVal * g)}
        </text>
      ))}
      {area && <path d={area} fill="url(#insightsAreaGrad)" />}
      {line && <path d={line} fill="none" stroke="#1a5c4f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {trend.map((p, i) => (
        <g key={p.date}>
          {i % everyN === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">{p.label}</text>
          )}
          <circle cx={x(i)} cy={y(p.pipelineValueSAR)} r="14" fill="transparent" onMouseEnter={() => setHover(i)} />
        </g>
      ))}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#1a5c4f" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(trend[hover].pipelineValueSAR)} r="5" fill="white" stroke="#1a5c4f" strokeWidth="2.5" />
          <g transform={`translate(${Math.min(Math.max(x(hover) - 70, 4), W - 144)}, 6)`}>
            <rect width="140" height="50" rx="8" fill="#1e1b4b" />
            <text x="70" y="18" textAnchor="middle" fontSize="10" fill="#a5b4c9">{trend[hover].label}</text>
            <text x="70" y="34" textAnchor="middle" fontSize="12" fontWeight="700" fill="white">SAR {money(trend[hover].pipelineValueSAR)}</text>
            <text x="70" y="46" textAnchor="middle" fontSize="9" fill="#7ee7cd">✓ {trend[hover].won}   ✕ {trend[hover].lost}   ● {trend[hover].newDeals}</text>
          </g>
        </g>
      )}
    </svg>
  );
}

/* ---------- Donut chart for lead sources ---------- */
function Donut({ rows }: { rows: { label: string; count: number }[] }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  if (!total) {
    return <p className="py-8 text-center text-[13px] text-[#94a3b8]">لا توجد بيانات</p>;
  }
  const R = 68, r = 42, cx = 90, cy = 90;
  let acc = 0;
  const slices = rows.map((row, i) => {
    const frac = row.count / total;
    const start = acc;
    const end = acc + frac;
    acc = end;
    const a0 = start * Math.PI * 2 - Math.PI / 2;
    const a1 = end * Math.PI * 2 - Math.PI / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
    const xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
    const path = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`;
    return { path, color: PALETTE[i % PALETTE.length], row, pct: Math.round(frac * 100) };
  });
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 180 180" width="180" height="180" className="flex-none">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />
        ))}
        <text x="90" y="86" textAnchor="middle" fontSize="12" fill="#94a3b8">إجمالي</text>
        <text x="90" y="106" textAnchor="middle" fontSize="24" fontWeight="800" fill="#1e1b4b">{total}</text>
      </svg>
      <div className="flex flex-1 flex-col gap-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: s.color }} />
            <span dir="auto" className="min-w-0 flex-1 truncate text-[#334155]">{s.row.label}</span>
            <span className="flex-none font-bold tabular-nums text-[#1e1b4b]">{s.row.count}</span>
            <span className="w-8 flex-none text-right text-[#94a3b8]">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Horizontal bar breakdown ---------- */
function BarBreakdown({
  rows,
  colorFor,
  valueMode = "count",
}: {
  rows: { label: string; count: number; valueSAR: number; color?: string | null }[];
  colorFor: (i: number, color?: string | null) => string;
  valueMode?: "count" | "value";
}) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[#94a3b8]">لا توجد بيانات لهذي الفترة</p>;
  }
  const max = Math.max(1, ...rows.map((r) => (valueMode === "value" ? r.valueSAR : r.count)));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const v = valueMode === "value" ? r.valueSAR : r.count;
        const pct = Math.max(4, Math.round((v / max) * 100));
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span dir="auto" className="font-medium text-[#334155]">{r.label}</span>
              <span className="font-bold tabular-nums text-[#1e1b4b]">
                {valueMode === "value" ? `SAR ${sar(r.valueSAR)}` : r.count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: colorFor(i, r.color) }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Sources table with junk-quality bars ---------- */
function SourcesTable({ rows }: { rows: InsightsData["sources"] }) {
  if (!rows.length) return <p className="py-8 text-center text-[13px] text-[#94a3b8]">لا توجد بيانات</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <th className="py-2 text-right font-semibold">المصدر</th>
            <th className="py-2 text-right font-semibold">الإجمالي</th>
            <th className="py-2 text-right font-semibold">نظيف</th>
            <th className="py-2 text-right font-semibold">جانك</th>
            <th className="py-2 text-right font-semibold">جودة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5" dir="auto">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate text-[#1e1b4b]">{r.label}</span>
                </div>
              </td>
              <td className="py-2.5 font-semibold tabular-nums text-[#1e1b4b]">{r.count}</td>
              <td className="py-2.5 tabular-nums text-[#10b981]">{r.clean}</td>
              <td className="py-2.5 tabular-nums text-[#ef4444]">{r.junk}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${r.cleanPct}%`, background: r.cleanPct >= 70 ? "#10b981" : r.cleanPct >= 40 ? "#f59e0b" : "#ef4444" }} />
                  </div>
                  <span className="w-9 text-right font-bold tabular-nums text-[#1e1b4b]">{r.cleanPct}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Top-value active deals table ---------- */
function TopDealsTable({ rows }: { rows: InsightsData["topActiveDeals"] }) {
  if (!rows.length) return <p className="py-8 text-center text-[13px] text-[#94a3b8]">لا توجد صفقات نشطة بهذي الفترة</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <th className="py-2 text-right font-semibold">الصفقة</th>
            <th className="py-2 text-right font-semibold">المرحلة</th>
            <th className="py-2 text-right font-semibold">القيمة</th>
            <th className="py-2 text-right font-semibold">الأيام</th>
            <th className="py-2 text-right font-semibold">الاحتمالية</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-[#f0faf8]/50">
              <td className="py-2.5" dir="auto">
                <Link href={`/dashboard/deals/${r.id}/investigation`} className="block">
                  <p className="truncate font-semibold text-[#1e1b4b] hover:text-primary">{r.name}</p>
                  {r.leadName && <p className="truncate text-[11px] text-[#94a3b8]">{r.leadName}</p>}
                </Link>
              </td>
              <td className="py-2.5">
                <span className="rounded-full bg-[#f0faf8] px-2 py-0.5 text-[11px] font-semibold text-primary">{r.stage}</span>
              </td>
              <td className="py-2.5 font-bold tabular-nums text-[#1e1b4b]">SAR {sar(r.valueSAR)}</td>
              <td className="py-2.5 tabular-nums text-[#475569]">{r.days} يوم</td>
              <td className="py-2.5">
                {r.probabilityPct != null ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${r.probabilityPct}%` }} />
                    </div>
                    <span className="w-8 text-right font-bold tabular-nums text-primary">{r.probabilityPct}%</span>
                  </div>
                ) : (
                  <span className="text-[#cbd5e1]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Recent lost deals table ---------- */
function LostDealsTable({ rows }: { rows: InsightsData["recentLostDeals"] }) {
  if (!rows.length) return <p className="py-8 text-center text-[13px] text-[#94a3b8]">لا توجد صفقات مخسورة بهذي الفترة 🎉</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <th className="py-2 text-right font-semibold">الصفقة</th>
            <th className="py-2 text-right font-semibold">المرحلة</th>
            <th className="py-2 text-right font-semibold">السبب</th>
            <th className="py-2 text-right font-semibold">الخسارة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-red-50/50">
              <td className="py-2.5" dir="auto">
                <Link href={`/dashboard/deals/${r.id}/investigation`} className="block">
                  <p className="truncate font-semibold text-[#1e1b4b] hover:text-primary">{r.name}</p>
                  {r.leadName && <p className="truncate text-[11px] text-[#94a3b8]">{r.leadName}</p>}
                </Link>
              </td>
              <td className="py-2.5 text-[#475569]">{r.stage}</td>
              <td className="py-2.5">
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">{r.reason}</span>
              </td>
              <td className="py-2.5 font-bold tabular-nums text-red-600">SAR {sar(r.valueSAR)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Icons for KPIs ---------- */
const IconLead = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11l2 2 4-4" /></svg>;
const IconDeal = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></svg>;
const IconMoney = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>;
const IconWin = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m3 17 6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>;
const IconLost = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></svg>;
const IconClock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;

/* ============= AI CHAT ============= */
interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function serializeContext(data: InsightsData): string {
  return `أنا الآن على صفحة "لوحة الرؤى الشاملة" في نظام Mawrid CRM، وهذي هي البيانات المفلترة الظاهرة أمامي بالضبط (الفترة: ${data.rangeLabel}):

## المؤشرات الرئيسية
- إجمالي الليدات: ${data.kpis.totalLeads} (نظيف ${data.kpis.cleanLeads} · جانك ${data.kpis.junkLeads})
- الصفقات النشطة: ${data.kpis.activeDeals}
- الصفقات المربوحة: ${data.kpis.wonDeals} (بقيمة SAR ${money(data.kpis.wonValueSAR)})
- الصفقات المخسورة: ${data.kpis.lostDeals}
- قيمة الـ Pipeline النشطة: SAR ${money(data.kpis.pipelineValueSAR)}
- نسبة الفوز: ${data.kpis.winRatePct}%
- متوسط مدة إغلاق الصفقة الرابحة: ${data.kpis.avgCycleDays ?? "—"} يوم
- إجمالي الأنشطة المسجّلة بالفترة: ${data.kpis.totalActivities}

## قمع المراحل (الصفقات النشطة)
${data.funnel.length ? data.funnel.map((f) => `- ${f.label}: ${f.count} صفقة (SAR ${money(f.valueSAR)})`).join("\n") : "(لا يوجد)"}

## مصادر الليدات مع الجودة
${data.sources.length ? data.sources.map((s) => `- ${s.label}: ${s.count} إجمالي (${s.clean} نظيف · ${s.junk} جانك · جودة ${s.cleanPct}%)`).join("\n") : "(لا يوجد)"}

## أسباب الخسارة
${data.lostReasons.length ? data.lostReasons.map((r) => `- ${r.label}: ${r.count} صفقة (خسارة SAR ${money(r.valueSAR)})`).join("\n") : "(لا يوجد)"}

## أعلى 10 صفقات نشطة بالقيمة
${data.topActiveDeals.length ? data.topActiveDeals.map((d, i) => `${i + 1}. ${d.name}${d.leadName ? ` — ${d.leadName}` : ""} — ${d.stage} — SAR ${money(d.valueSAR)} — ${d.days} يوم${d.probabilityPct != null ? ` — احتمالية ${d.probabilityPct}%` : ""}`).join("\n") : "(لا يوجد)"}

## آخر 10 صفقات مخسورة
${data.recentLostDeals.length ? data.recentLostDeals.map((d, i) => `${i + 1}. ${d.name}${d.leadName ? ` — ${d.leadName}` : ""} — ${d.stage} — سبب: ${d.reason} — SAR ${money(d.valueSAR)}`).join("\n") : "(لا يوجد)"}

## اتجاه قيمة الـ Pipeline اليومي (أحدث ${Math.min(10, data.trend.length)} أيام)
${data.trend.slice(-10).map((t) => `- ${t.label}: SAR ${money(t.pipelineValueSAR)} · ✓ ${t.won} · ✕ ${t.lost} · 🆕 ${t.newDeals}`).join("\n")}`;
}

/** Playful, on-brand chat avatar — a rounded "robot" head in the app's teal
 * gradient with a subtle floating animation. Pure SVG + CSS, no external
 * asset. */
function RobotAvatar({ size = 44 }: { size?: number }) {
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "linear-gradient(135deg, #1a5c4f 0%, #2d8570 100%)",
          boxShadow: "0 6px 18px rgba(26,92,79,0.35), inset 0 -3px 0 rgba(0,0,0,0.12), inset 0 3px 0 rgba(255,255,255,0.15)",
          animation: "insightsBotFloat 3.6s ease-in-out infinite",
        }}
      />
      <svg viewBox="0 0 44 44" className="absolute inset-0" width={size} height={size}>
        {/* antenna */}
        <line x1="22" y1="6" x2="22" y2="10" stroke="#7ee7cd" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="22" cy="5" r="1.6" fill="#7ee7cd" />
        {/* face plate */}
        <rect x="10" y="14" width="24" height="18" rx="5" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
        {/* eyes */}
        <circle cx="17" cy="23" r="2.2" fill="#7ee7cd">
          <animate attributeName="r" values="2.2;0.4;2.2" keyTimes="0;0.05;0.1" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="27" cy="23" r="2.2" fill="#7ee7cd">
          <animate attributeName="r" values="2.2;0.4;2.2" keyTimes="0;0.05;0.1" dur="4s" repeatCount="indefinite" />
        </circle>
        {/* smile */}
        <path d="M18 28 Q22 30.5 26 28" stroke="#7ee7cd" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        {/* side ears */}
        <rect x="7" y="19" width="3" height="8" rx="1.5" fill="rgba(255,255,255,0.15)" />
        <rect x="34" y="19" width="3" height="8" rx="1.5" fill="rgba(255,255,255,0.15)" />
      </svg>
      <style jsx>{`
        @keyframes insightsBotFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

function InsightsChat({ data }: { data: InsightsData }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [value, setValue] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantMsg: ChatMsg = { id: crypto.randomUUID(), role: "assistant", content: "" };
    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setValue("");
    setStreaming(true);
    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          context: serializeContext(data),
        }),
      });
      if (!res.ok || !res.body) {
        let msg = "تعذّر الحصول على رد الآن. حاول مرة أخرى.";
        try {
          const j = await res.json();
          if (typeof j?.message === "string") msg = j.message;
        } catch {
          /* body may be empty */
        }
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: msg } : m)));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        acc += decoder.decode(chunk, { stream: true });
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)));
      }
    } catch (err) {
      console.error("[InsightsChat] send failed", err);
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: "تعذّر الاتصال. تأكّد من الشبكة وحاول مجدداً." } : m)));
    } finally {
      setStreaming(false);
    }
  }, [messages, streaming, data]);

  const chips = [
    "لخّص لي أداء هذي الفترة",
    "ليش بدأنا نخسر صفقات أكثر؟",
    "أي مصدر عملاء أعلى جودة؟",
    "أي صفقة نشطة الأولوية؟",
    "وش أكبر سبب خسارة بالقيمة؟",
  ];

  return (
    <div className={`${CARD} flex flex-col overflow-hidden`}>
      {/* Header — meet-the-assistant band */}
      <div
        className="flex items-center gap-4 px-6 py-4 text-white"
        style={{ background: "linear-gradient(135deg, #0d3b30 0%, #1a5c4f 55%, #2d8570 100%)" }}
      >
        <RobotAvatar size={52} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p dir="auto" className="text-[17px] font-extrabold">أهلاً 👋 أنا مساعدك مورد</p>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7ee7cd]">Live</span>
          </div>
          <p dir="auto" className="mt-0.5 text-[12.5px] text-white/70">
            عندي اطلاع كامل على كل الأرقام الظاهرة فوق ({data.rangeLabel}) — اسألني أي شيء
          </p>
        </div>
        <div className="hidden flex-none rounded-xl bg-white/10 px-3 py-1.5 text-center sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">صفقات نشطة</p>
          <p className="text-[15px] font-bold tabular-nums">{data.kpis.activeDeals}</p>
        </div>
        <div className="hidden flex-none rounded-xl bg-white/10 px-3 py-1.5 text-center sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Pipeline</p>
          <p className="text-[15px] font-bold tabular-nums">SAR {sar(data.kpis.pipelineValueSAR)}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="max-h-[440px] min-h-[220px] overflow-y-auto bg-gradient-to-b from-[#fafcfb] to-white px-6 py-5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p dir="auto" className="text-[14px] font-semibold text-[#1e1b4b]">جرّب اسألني:</p>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => send(c)}
                  className="rounded-full border border-gray-100 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#475569] shadow-sm transition-all hover:-translate-y-px hover:border-primary/30 hover:bg-mint hover:text-primary"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="mb-1 flex-none">
                    <RobotAvatar size={32} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-2.5 text-[14px] leading-relaxed ${m.role === "user" ? "" : "shadow-[0_2px_8px_rgba(0,0,0,0.04)]"}`}
                  style={
                    m.role === "user"
                      ? { background: "linear-gradient(135deg, #1A5C4F 0%, #2D8570 100%)", borderRadius: "18px 18px 4px 18px", color: "#fff" }
                      : { background: "#fff", border: "1px solid #E8EFED", borderRadius: "4px 18px 18px 18px", color: "#1C2B26" }
                  }
                >
                  {m.role === "user" ? <p dir="auto" className="whitespace-pre-wrap">{m.content}</p> : <RichText content={m.content || "…"} />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-100 bg-white p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send(value);
              }
            }}
            dir="auto"
            placeholder="اسأل مساعدك مورد عن أي رقم أو نمط بالصفحة..."
            className="flex-1 border-0 bg-transparent px-2 py-1.5 text-[14px] text-[#334155] placeholder:text-[#94a3b8] focus:outline-none"
          />
          <button
            onClick={() => send(value)}
            disabled={streaming || !value.trim()}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-white shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:scale-100 disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #1A5C4F 0%, #2D8570 100%)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 -rotate-90">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============= PAGE ============= */
export default function InsightsTab() {
  const [range, setRange] = useState<DateRangeKey>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(toISODate(new Date()));
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (r: DateRangeKey, custom?: CustomRange) => {
    if (r === "custom" && (!custom || !custom.from)) return;
    setRefreshing(true);
    setError(false);
    try {
      const d = await buildInsights(r, custom);
      setData(d);
    } catch (err) {
      console.error("[Insights] build failed", err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (range === "custom") {
      if (customFrom) load("custom", { from: customFrom, to: customTo });
    } else {
      load(range);
    }
  }, [range, customFrom, customTo, load]);

  const funnelColor = useMemo(() => (i: number, color?: string | null) => color || PALETTE[i % PALETTE.length], []);

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-white" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-72" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">⚠️</div>
        <p className="text-[15px] text-[#94a3b8]">تعذّر تحميل لوحة الرؤى.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Sticky filter bar ─────────────────────────────────────── */}
      <div className="sticky top-16 z-10 -mx-8 -mt-8 border-b border-gray-100 bg-white/85 px-8 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 dir="auto" className="text-[22px] font-extrabold tracking-tight text-[#1e1b4b]">لوحة الرؤى</h1>
              <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Live</span>
              {refreshing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
            </div>
            <p dir="auto" className="mt-0.5 text-[13px] text-[#94a3b8]">كل الأرقام مفلترة على: <span className="font-semibold text-[#475569]">{data.rangeLabel}</span></p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full border border-gray-100 bg-white p-1 shadow-sm">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                    range === r.key ? "bg-primary text-white shadow-sm" : "text-[#475569] hover:bg-mint"
                  }`}
                >
                  {r.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setRange("custom");
                  if (!customFrom) setCustomFrom(toISODate(new Date(Date.now() - 30 * 86_400_000)));
                }}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                  range === "custom" ? "bg-primary text-white shadow-sm" : "text-[#475569] hover:bg-mint"
                }`}
              >
                مخصص
              </button>
            </div>
            {range === "custom" && (
              <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-[12.5px] shadow-sm">
                <label className="text-[#94a3b8]">من</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border-0 bg-transparent text-[12.5px] text-[#334155] focus:outline-none"
                />
                <span className="text-[#cbd5e1]">—</span>
                <label className="text-[#94a3b8]">إلى</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border-0 bg-transparent text-[12.5px] text-[#334155] focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="الليدات" value={String(data.kpis.totalLeads)} sub={`نظيف ${data.kpis.cleanLeads} · جانك ${data.kpis.junkLeads}`} color="#1a5c4f" icon={<IconLead />} />
        <Kpi label="صفقات نشطة" value={String(data.kpis.activeDeals)} sub={`${data.kpis.totalActivities} نشاط`} color="#6366f1" icon={<IconDeal />} />
        <Kpi label="قيمة Pipeline" value={`SAR ${sar(data.kpis.pipelineValueSAR)}`} sub={`مربوح SAR ${sar(data.kpis.wonValueSAR)}`} color="#f59e0b" icon={<IconMoney />} />
        <Kpi label="نسبة الفوز" value={`${data.kpis.winRatePct}%`} sub={`${data.kpis.wonDeals} مربوحة`} color="#10b981" icon={<IconWin />} />
        <Kpi label="مخسورة" value={String(data.kpis.lostDeals)} sub={`من أصل ${data.kpis.wonDeals + data.kpis.lostDeals}`} color="#ef4444" icon={<IconLost />} />
        <Kpi label="متوسط الإغلاق" value={data.kpis.avgCycleDays != null ? `${data.kpis.avgCycleDays} يوم` : "—"} color="#0ea5e9" icon={<IconClock />} />
      </div>

      {/* ── Trend ─────────────────────────────────────────────────── */}
      <div className={`${CARD} p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-bold text-[#1e1b4b]">اتجاه قيمة الـ Pipeline</h3>
            <p dir="auto" className="text-[12.5px] text-[#94a3b8]">مرّر فوق أي يوم لعرض تفاصيل: القيمة · المربوح · المخسور · الجديد</p>
          </div>
          <div className="hidden gap-4 sm:flex">
            <span className="flex items-center gap-1.5 text-[11px] text-[#475569]"><span className="h-2 w-2 rounded-full bg-primary" /> Pipeline</span>
          </div>
        </div>
        <TrendChart trend={data.trend} />
      </div>

      {/* ── Row: Funnel + Donut + Loss reasons ───────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={`${CARD} p-6`}>
          <div className="mb-4">
            <h3 className="text-[15px] font-bold text-[#1e1b4b]">قمع المراحل</h3>
            <p className="text-[12px] text-[#94a3b8]">الصفقات النشطة حسب المرحلة</p>
          </div>
          <BarBreakdown rows={data.funnel} colorFor={funnelColor} />
        </div>
        <div className={`${CARD} p-6`}>
          <div className="mb-4">
            <h3 className="text-[15px] font-bold text-[#1e1b4b]">مصادر الليدات</h3>
            <p className="text-[12px] text-[#94a3b8]">توزيع نسبي بالفترة</p>
          </div>
          <Donut rows={data.sources.map((s) => ({ label: s.label, count: s.count }))} />
        </div>
        <div className={`${CARD} p-6`}>
          <div className="mb-4">
            <h3 className="text-[15px] font-bold text-[#1e1b4b]">أسباب الخسارة</h3>
            <p className="text-[12px] text-[#94a3b8]">مرتبة بالقيمة المخسورة</p>
          </div>
          <BarBreakdown rows={data.lostReasons} colorFor={funnelColor} valueMode="value" />
        </div>
      </div>

      {/* ── Sources quality table ────────────────────────────────── */}
      <div className={`${CARD} p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-[#1e1b4b]">جودة المصادر تفصيلياً</h3>
            <p className="text-[12px] text-[#94a3b8]">نسبة الليدات النظيفة لكل مصدر</p>
          </div>
          <Link href="/dashboard/leads" className="rounded-full border border-gray-100 px-3 py-1 text-[12px] font-semibold text-[#475569] transition hover:border-primary hover:text-primary">
            كل الليدات →
          </Link>
        </div>
        <SourcesTable rows={data.sources} />
      </div>

      {/* ── Two tables: Top active + Recent lost ─────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={`${CARD} p-6`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-bold text-[#1e1b4b]">أعلى الصفقات النشطة</h3>
              <p className="text-[12px] text-[#94a3b8]">مرتبة بالقيمة المتوقعة</p>
            </div>
            <Link href="/dashboard/deals" className="rounded-full border border-gray-100 px-3 py-1 text-[12px] font-semibold text-[#475569] transition hover:border-primary hover:text-primary">
              كل الصفقات →
            </Link>
          </div>
          <TopDealsTable rows={data.topActiveDeals} />
        </div>
        <div className={`${CARD} p-6`}>
          <div className="mb-4">
            <h3 className="text-[15px] font-bold text-[#1e1b4b]">آخر الصفقات المخسورة</h3>
            <p className="text-[12px] text-[#94a3b8]">اضغط أي صفقة لفتح تقرير التحقيق</p>
          </div>
          <LostDealsTable rows={data.recentLostDeals} />
        </div>
      </div>

      {/* ── Embedded AI ──────────────────────────────────────────── */}
      <InsightsChat data={data} />
    </div>
  );
}
