"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buildInsights, type InsightsData, type DateRangeKey, type CustomRange } from "@/lib/insights/buildInsights";
import { money } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import RichText from "@/components/copilot/RichText";
import Skeleton from "@/components/ui/Skeleton";
import { AlertIcon, ChartBarIcon } from "@/components/icons";

const CARD = "rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)]";
const RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "7d", label: "7 أيام" },
  { key: "30d", label: "30 يوم" },
  { key: "90d", label: "90 يوم" },
  { key: "year", label: "هذي السنة" },
  { key: "all", label: "الكل" },
];

const PALETTE = ["var(--brand-teal-700)", "var(--brand-teal-500)", "var(--brand-amber-500)", "var(--brand-indigo-500)", "var(--brand-red-500)", "var(--content-accent)", "var(--content-accent)", "var(--brand-green-500)", "var(--content-accent)", "var(--brand-teal-500)"];

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
    <div className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)] shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.05),0_12px_32px_rgba(0,0,0,0.03)]">
      <span className="absolute bottom-3 left-0 top-3 w-1 rounded-full" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <p dir="auto" className="t-micro font-semibold uppercase tracking-wider text-[var(--content-tertiary)]">{label}</p>
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-md)] transition-transform group-hover:scale-105" style={{ background: `${color}1a`, color }}>
          {icon}
        </span>
      </div>
      <p className="mt-3 t-figure-md font-black leading-none tabular-nums text-[var(--content-primary)]">{value}</p>
      {sub && <p dir="auto" className="mt-1.5 t-caption font-medium text-[var(--content-tertiary)]">{sub}</p>}
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
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-accent-subtle)] text-2xl"><ChartBarIcon className="h-4 w-4" /></div>
        <p dir="auto" className="t-body-sm text-[var(--content-tertiary)]">لا توجد بيانات لعرضها بهذي الفترة</p>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="insightsAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-teal-700)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--brand-teal-700)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={padL} x2={W - padR} y1={y(maxVal * g)} y2={y(maxVal * g)} stroke="var(--surface-sunken)" strokeWidth="1" />
      ))}
      {[0, 0.5, 1].map((g) => (
        <text key={`y${g}`} x={4} y={y(maxVal * g) + 3} fontSize="9" fill="var(--border-strong)">
          {sar(maxVal * g)}
        </text>
      ))}
      {area && <path d={area} fill="url(#insightsAreaGrad)" />}
      {line && <path d={line} fill="none" stroke="var(--brand-teal-700)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {trend.map((p, i) => (
        <g key={p.date}>
          {i % everyN === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--content-tertiary)">{p.label}</text>
          )}
          <circle cx={x(i)} cy={y(p.pipelineValueSAR)} r="14" fill="transparent" onMouseEnter={() => setHover(i)} />
        </g>
      ))}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--brand-teal-700)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(trend[hover].pipelineValueSAR)} r="5" fill="white" stroke="var(--brand-teal-700)" strokeWidth="2.5" />
          <g transform={`translate(${Math.min(Math.max(x(hover) - 70, 4), W - 144)}, 6)`}>
            <rect width="140" height="50" rx="8" fill="var(--content-primary)" />
            <text x="70" y="18" textAnchor="middle" fontSize="10" fill="var(--content-inverse-tertiary)">{trend[hover].label}</text>
            <text x="70" y="34" textAnchor="middle" fontSize="12" fontWeight="700" fill="white">SAR {money(trend[hover].pipelineValueSAR)}</text>
            <text x="70" y="46" textAnchor="middle" fontSize="9" fill="var(--brand-teal-300)"> {trend[hover].won}    {trend[hover].lost}   ● {trend[hover].newDeals}</text>
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
    return <p className="py-8 text-center t-body-sm text-[var(--content-tertiary)]">لا توجد بيانات</p>;
  }
  const R = 68, r = 42, cx = 90, cy = 90;
  const { slices } = rows.reduce<{ acc: number; slices: { path: string; color: string; row: { label: string; count: number }; pct: number }[] }>(
    (state, row, i) => {
      const frac = row.count / total;
      const start = state.acc;
      const end = start + frac;
      const a0 = start * Math.PI * 2 - Math.PI / 2;
      const a1 = end * Math.PI * 2 - Math.PI / 2;
      const large = frac > 0.5 ? 1 : 0;
      const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
      const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
      const xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
      const xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
      const path = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`;
      const slice = { path, color: PALETTE[i % PALETTE.length], row, pct: Math.round(frac * 100) };
      return { acc: end, slices: [...state.slices, slice] };
    },
    { acc: 0, slices: [] },
  );
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 180 180" width="180" height="180" className="flex-none">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />
        ))}
        <text x="90" y="86" textAnchor="middle" fontSize="12" fill="var(--content-tertiary)">إجمالي</text>
        <text x="90" y="106" textAnchor="middle" fontSize="24" fontWeight="800" fill="var(--content-primary)">{total}</text>
      </svg>
      <div className="flex flex-1 flex-col gap-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 t-caption">
            <span className="h-2.5 w-2.5 flex-none rounded-[var(--radius-xs)]" style={{ background: s.color }} />
            <span dir="auto" className="min-w-0 flex-1 truncate text-[var(--content-secondary)]">{s.row.label}</span>
            <span className="flex-none font-bold tabular-nums text-[var(--content-primary)]">{s.row.count}</span>
            <span className="w-8 flex-none text-right text-[var(--content-tertiary)]">{s.pct}%</span>
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
    return <p className="py-8 text-center t-body-sm text-[var(--content-tertiary)]">لا توجد بيانات لهذي الفترة</p>;
  }
  const max = Math.max(1, ...rows.map((r) => (valueMode === "value" ? r.valueSAR : r.count)));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => {
        const v = valueMode === "value" ? r.valueSAR : r.count;
        const pct = Math.max(4, Math.round((v / max) * 100));
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between t-body-sm">
              <span dir="auto" className="font-medium text-[var(--content-secondary)]">{r.label}</span>
              <span className="font-bold tabular-nums text-[var(--content-primary)]">
                {valueMode === "value" ? `SAR ${sar(r.valueSAR)}` : r.count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
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
  if (!rows.length) return <p className="py-8 text-center t-body-sm text-[var(--content-tertiary)]">لا توجد بيانات</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full t-body-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] t-micro font-semibold uppercase tracking-wider text-[var(--content-tertiary)]">
            <th className="py-2 text-right font-semibold">المصدر</th>
            <th className="py-2 text-right font-semibold">الإجمالي</th>
            <th className="py-2 text-right font-semibold">نظيف</th>
            <th className="py-2 text-right font-semibold">جانك</th>
            <th className="py-2 text-right font-semibold">جودة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label} className="border-b border-[var(--border-subtle)] last:border-0">
              <td className="py-2.5" dir="auto">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 flex-none rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate text-[var(--content-primary)]">{r.label}</span>
                </div>
              </td>
              <td className="py-2.5 font-semibold tabular-nums text-[var(--content-primary)]">{r.count}</td>
              <td className="py-2.5 tabular-nums text-[var(--brand-green-500)]">{r.clean}</td>
              <td className="py-2.5 tabular-nums text-[var(--brand-red-500)]">{r.junk}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div className="h-full rounded-full" style={{ width: `${r.cleanPct}%`, background: r.cleanPct >= 70 ? "var(--brand-green-500)" : r.cleanPct >= 40 ? "var(--brand-amber-500)" : "var(--brand-red-500)" }} />
                  </div>
                  <span className="w-9 text-right font-bold tabular-nums text-[var(--content-primary)]">{r.cleanPct}%</span>
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
  if (!rows.length) return <p className="py-8 text-center t-body-sm text-[var(--content-tertiary)]">لا توجد صفقات نشطة بهذي الفترة</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full t-body-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] t-micro font-semibold uppercase tracking-wider text-[var(--content-tertiary)]">
            <th className="py-2 text-right font-semibold">الصفقة</th>
            <th className="py-2 text-right font-semibold">المرحلة</th>
            <th className="py-2 text-right font-semibold">القيمة</th>
            <th className="py-2 text-right font-semibold">الأيام</th>
            <th className="py-2 text-right font-semibold">الاحتمالية</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-accent-subtle)]/50">
              <td className="py-2.5" dir="auto">
                <Link href={`/dashboard/deals/${r.id}/investigation`} className="block">
                  <p className="truncate font-semibold text-[var(--content-primary)] hover:text-primary">{r.name}</p>
                  {r.leadName && <p className="truncate t-micro text-[var(--content-tertiary)]">{r.leadName}</p>}
                </Link>
              </td>
              <td className="py-2.5">
                <span className="rounded-full bg-[var(--surface-accent-subtle)] px-2 py-0.5 t-micro font-semibold text-primary">{r.stage}</span>
              </td>
              <td className="py-2.5 font-bold tabular-nums text-[var(--content-primary)]">SAR {sar(r.valueSAR)}</td>
              <td className="py-2.5 tabular-nums text-[var(--content-secondary)]">{r.days} يوم</td>
              <td className="py-2.5">
                {r.probabilityPct != null ? (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${r.probabilityPct}%` }} />
                    </div>
                    <span className="w-8 text-right font-bold tabular-nums text-primary">{r.probabilityPct}%</span>
                  </div>
                ) : (
                  <span className="text-[var(--border-strong)]">—</span>
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
  if (!rows.length) return <p className="py-8 text-center t-body-sm text-[var(--content-tertiary)]">لا توجد صفقات مخسورة بهذي الفترة</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full t-body-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] t-micro font-semibold uppercase tracking-wider text-[var(--content-tertiary)]">
            <th className="py-2 text-right font-semibold">الصفقة</th>
            <th className="py-2 text-right font-semibold">المرحلة</th>
            <th className="py-2 text-right font-semibold">السبب</th>
            <th className="py-2 text-right font-semibold">الخسارة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[color-mix(in_srgb,var(--status-danger-bg)_50%,transparent)]">
              <td className="py-2.5" dir="auto">
                <Link href={`/dashboard/deals/${r.id}/investigation`} className="block">
                  <p className="truncate font-semibold text-[var(--content-primary)] hover:text-primary">{r.name}</p>
                  {r.leadName && <p className="truncate t-micro text-[var(--content-tertiary)]">{r.leadName}</p>}
                </Link>
              </td>
              <td className="py-2.5 text-[var(--content-secondary)]">{r.stage}</td>
              <td className="py-2.5">
                <span className="rounded-full bg-[var(--status-danger-bg)] px-2 py-0.5 t-micro font-semibold text-[var(--status-danger-fg)]">{r.reason}</span>
              </td>
              <td className="py-2.5 font-bold tabular-nums text-[var(--status-danger-fg)]">SAR {sar(r.valueSAR)}</td>
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
  return `أنا الآن على صفحة"لوحة الرؤى الشاملة"في نظام Mawrid CRM، وهذي هي البيانات المفلترة الظاهرة أمامي بالضبط (الفترة: ${data.rangeLabel}):

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
${data.trend.slice(-10).map((t) => `- ${t.label}: SAR ${money(t.pipelineValueSAR)} ·  ${t.won} ·  ${t.lost} · 🆕 ${t.newDeals}`).join("\n")}`;
}

/** Playful, on-brand chat avatar — a rounded "robot" head in the app's teal
 * gradient with a subtle floating animation. Pure SVG + CSS, no external
 * asset. */


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
        <div className="h-9 w-64 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-raised)]" />
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
        <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--status-danger-bg)] text-2xl"><AlertIcon className="h-4 w-4" /></div>
        <p className="t-body text-[var(--content-tertiary)]">تعذّر تحميل لوحة الرؤى.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero header ───────────────────────────────────────────── */}
      <div className="rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] px-7 py-7">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-[var(--radius-lg)] bg-white/10">
              <svg viewBox="0 0 20 20" fill="none" stroke="var(--surface-raised)" strokeWidth={1.8} className="h-6 w-6"><path d="M3 17V9M9 17V4M15 17v-6M3 3v14h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 dir="auto" className="t-title-1 font-bold tracking-[-0.02em] text-white">لوحة الرؤى</h1>
                <span className="rounded-full bg-[var(--brand-teal-400)]/20 px-2 py-0.5 t-micro font-bold uppercase tracking-wider text-[var(--brand-teal-300)]">مباشر</span>
                {refreshing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand-teal-400)]" />}
              </div>
              <p dir="auto" className="mt-1 text-sm text-white/50">كل الأرقام مفلترة على: <span className="font-semibold text-white/80">{data.rangeLabel}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-compact)] e-1">
        <div className="flex gap-1 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-[var(--radius-sm)] px-3.5 py-1.5 t-caption font-semibold transition ${
                range === r.key ? "bg-[var(--brand-teal-700)] text-white shadow-sm" : "text-[var(--content-secondary)] hover:bg-[var(--surface-accent-subtle)]"
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
            className={`rounded-[var(--radius-sm)] px-3.5 py-1.5 t-caption font-semibold transition ${
              range === "custom" ? "bg-[var(--brand-teal-700)] text-white shadow-sm" : "text-[var(--content-secondary)] hover:bg-[var(--surface-accent-subtle)]"
            }`}
          >مخصص</button>
        </div>
        {range === "custom" && (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-1.5 t-caption">
            <label className="text-[var(--content-tertiary)]">من</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="border-0 bg-transparent t-caption text-[var(--content-secondary)] focus:outline-none"
            />
            <span className="text-[var(--border-strong)]">—</span>
            <label className="text-[var(--content-tertiary)]">إلى</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="border-0 bg-transparent t-caption text-[var(--content-secondary)] focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* ── KPI grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="الليدات" value={String(data.kpis.totalLeads)} sub={`نظيف ${data.kpis.cleanLeads} · جانك ${data.kpis.junkLeads}`} color="var(--brand-teal-700)" icon={<IconLead />} />
        <Kpi label="صفقات نشطة" value={String(data.kpis.activeDeals)} sub={`${data.kpis.totalActivities} نشاط`} color="var(--brand-indigo-500)" icon={<IconDeal />} />
        <Kpi label="قيمة Pipeline" value={`SAR ${sar(data.kpis.pipelineValueSAR)}`} sub={`مربوح SAR ${sar(data.kpis.wonValueSAR)}`} color="var(--brand-amber-500)" icon={<IconMoney />} />
        <Kpi label="نسبة الفوز" value={`${data.kpis.winRatePct}%`} sub={`${data.kpis.wonDeals} مربوحة`} color="var(--brand-green-500)" icon={<IconWin />} />
        <Kpi label="مخسورة" value={String(data.kpis.lostDeals)} sub={`من أصل ${data.kpis.wonDeals + data.kpis.lostDeals}`} color="var(--brand-red-500)" icon={<IconLost />} />
        <Kpi label="متوسط الإغلاق" value={data.kpis.avgCycleDays != null ? `${data.kpis.avgCycleDays} يوم` : "—"} color="var(--content-accent)" icon={<IconClock />} />
      </div>

      {/* ── Trend ─────────────────────────────────────────────────── */}
      <div className={`${CARD} p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="t-body-lg font-bold text-[var(--content-primary)]">اتجاه قيمة الـ Pipeline</h3>
            <p dir="auto" className="t-caption text-[var(--content-tertiary)]">مرّر فوق أي يوم لعرض تفاصيل: القيمة · المربوح · المخسور · الجديد</p>
          </div>
          <div className="hidden gap-4 sm:flex">
            <span className="flex items-center gap-1.5 t-micro text-[var(--content-secondary)]"><span className="h-2 w-2 rounded-full bg-primary" /> Pipeline</span>
          </div>
        </div>
        <TrendChart trend={data.trend} />
      </div>

      {/* ── Row: Funnel + Donut + Loss reasons ───────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={`${CARD} p-6`}>
          <div className="mb-4">
            <h3 className="t-body font-bold text-[var(--content-primary)]">قمع المراحل</h3>
            <p className="t-caption text-[var(--content-tertiary)]">الصفقات النشطة حسب المرحلة</p>
          </div>
          <BarBreakdown rows={data.funnel} colorFor={funnelColor} />
        </div>
        <div className={`${CARD} p-6`}>
          <div className="mb-4">
            <h3 className="t-body font-bold text-[var(--content-primary)]">مصادر الليدات</h3>
            <p className="t-caption text-[var(--content-tertiary)]">توزيع نسبي بالفترة</p>
          </div>
          <Donut rows={data.sources.map((s) => ({ label: s.label, count: s.count }))} />
        </div>
        <div className={`${CARD} p-6`}>
          <div className="mb-4">
            <h3 className="t-body font-bold text-[var(--content-primary)]">أسباب الخسارة</h3>
            <p className="t-caption text-[var(--content-tertiary)]">مرتبة بالقيمة المخسورة</p>
          </div>
          <BarBreakdown rows={data.lostReasons} colorFor={funnelColor} valueMode="value" />
        </div>
      </div>

      {/* ── Sources quality table ────────────────────────────────── */}
      <div className={`${CARD} p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="t-body font-bold text-[var(--content-primary)]">جودة المصادر تفصيلياً</h3>
            <p className="t-caption text-[var(--content-tertiary)]">نسبة الليدات النظيفة لكل مصدر</p>
          </div>
          <Link href="/dashboard/leads" className="rounded-full border border-[var(--border-subtle)] px-3 py-1 t-caption font-semibold text-[var(--content-secondary)] transition hover:border-primary hover:text-primary">كل الليدات →
          </Link>
        </div>
        <SourcesTable rows={data.sources} />
      </div>

      {/* ── Two tables: Top active + Recent lost ─────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={`${CARD} p-6`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="t-body font-bold text-[var(--content-primary)]">أعلى الصفقات النشطة</h3>
              <p className="t-caption text-[var(--content-tertiary)]">مرتبة بالقيمة المتوقعة</p>
            </div>
            <Link href="/dashboard/deals" className="rounded-full border border-[var(--border-subtle)] px-3 py-1 t-caption font-semibold text-[var(--content-secondary)] transition hover:border-primary hover:text-primary">كل الصفقات →
            </Link>
          </div>
          <TopDealsTable rows={data.topActiveDeals} />
        </div>
        <div className={`${CARD} p-6`}>
          <div className="mb-4">
            <h3 className="t-body font-bold text-[var(--content-primary)]">آخر الصفقات المخسورة</h3>
            <p className="t-caption text-[var(--content-tertiary)]">اضغط أي صفقة لفتح تقرير التحقيق</p>
          </div>
          <LostDealsTable rows={data.recentLostDeals} />
        </div>
      </div>

      {/* ── Embedded AI ──────────────────────────────────────────── */}
    </div>
  );
}
