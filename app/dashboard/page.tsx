"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LeadsIcon, CheckCircleIcon, RevenueIcon, TrendingUpIcon, ActivitiesIcon } from "@/components/navIcons";
import { AlertIcon, CalendarIcon, CelebrationIcon, ChartBarIcon, ChatBubbleIcon, ClockIcon, DotIcon, EmptyChartIcon, MailIcon, PhoneIcon, TargetIcon, WifiOffIcon } from "@/components/icons";
import { Panel, PanelHead, CommandBand, BandButton } from "@/components/ui/Panel";
import CountUp from "@/components/ui/CountUp";
import Sparkline from "@/components/ui/Sparkline";
import { useToast } from "@/components/Toast";
import NewLeadSlideOver from "@/components/NewLeadSlideOver";
import LogActivitySlideOver from "@/components/LogActivitySlideOver";
import AddContactSlideOver from "@/components/AddContactSlideOver";
import { dayHeader, dayKey, formatDate, formatDateTime, initials, money, compactSAR, DATE_LOCALE, formatLongDate } from "@/lib/format";
import { fetchLeadsSummary } from "@/lib/models/leads";
import { fetchDealsSummary } from "@/lib/models/deals";
import { fetchRecentActivities } from "@/lib/models/activities";
import { fetchUpcomingTasks, completeTaskQuick } from "@/lib/models/tasks";
import LedgerSection from "@/components/ui/LedgerSection";

/* ---------- Types ---------- */
type Stage = { label: string; terminal_type: string | null } | null;
interface Lead {
  id: number | string;
  full_name: string | null;
  created_at: string | null;
  junk_reason_id: number | null;
  establishment_id?: number | string | null;
  sources: { label: string } | null;
  pipeline_stages?: Stage;
}
interface Deal {
  id: number | string;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  created_at: string | null;
  pipeline_stages: Stage;
}
/** Value of a deal for charting: expected, falling back to realised won value. */
function dealValue(d: Deal): number {
  return (d.expected_value_minor ?? d.won_value_minor ?? 0) / 100;
}
interface Activity {
  id: number | string;
  body: string | null;
  occurred_at: string | null;
  direction: string | null;
  activity_types: { label: string; color?: string | null } | null;
}
interface Task {
  id: number | string;
  title?: string | null;
  name?: string | null;
  due_at: string | null;
}

/* ---------- Helpers ---------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 18) return "مساء الخير";
  return "مساء الخير";
}
function longDate(d: Date) {
  return formatLongDate(d);
}
function timeOf(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function last7Days(anchor: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
}
function sameDay(iso: string | null | undefined, day: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
}
/** True when `iso` falls in the calendar month `offset` months before `anchor`. */
function monthOffset(iso: string | null, offset: number, anchor: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  const ref = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}
/** Latest activity date across records — anchors the dashboard windows to real data. */
function latestDate(iso: (string | null)[]): Date {
  let max = 0;
  for (const s of iso) {
    if (!s) continue;
    const t = new Date(s).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  const now = Date.now();
  // Use the most recent data point, but never a future date beyond today.
  return new Date(Math.min(max || now, now));
}
function trendText(cur: number, prev: number): { text: string; dir: "up" | "down" | "flat" } {
  if (prev === 0 && cur === 0) return { text: "لا بيانات بعد", dir: "flat" };
  if (prev === 0) return { text: "أول شهر", dir: "flat" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: "بدون تغيير", dir: "flat" };
  if (pct > 0) return { text: `${pct}% عن الشهر الماضي`, dir: "up" };
  return { text: `${Math.abs(pct)}% عن الشهر الماضي`, dir: "down" };
}
/* Status hues on navy need their light-surface values lifted, or they fail
   contrast against the band. These are the -500 stops, which clear AA there. */
const TREND_ON_NAVY: Record<"up" | "down" | "flat", string> = {
  up: "text-[var(--status-success-on-inverse)]",
  down: "text-[var(--status-danger-on-inverse)]",
  flat: "text-[color:var(--content-inverse-tertiary)]",
};
const OVERVIEW_DOT = {
  accent: "bg-[var(--content-accent)]",
  success: "bg-[var(--status-success-fg)]",
  danger: "bg-[var(--status-danger-fg)]",
} as const;
const OVERVIEW_BADGE = {
  accent: "bg-[var(--surface-accent-subtle)] text-[color:var(--content-accent)]",
  success: "bg-[var(--status-success-bg)] text-[color:var(--status-success-fg)]",
  danger: "bg-[var(--status-danger-bg)] text-[color:var(--status-danger-fg)]",
} as const;
function taskTitle(t: Task) {
  return t.title || t.name || "مهمة بدون عنوان";
}
function ActivityGlyph({ label, className }: { label?: string | null; className?: string }) {
  const l = (label || "").toLowerCase();
  if (l.includes("whatsapp")) return <ChatBubbleIcon className={className} />;
  if (l.includes("call")) return <PhoneIcon className={className} />;
  if (l.includes("email")) return <MailIcon className={className} />;
  if (l.includes("meeting")) return <CalendarIcon className={className} />;
  return <DotIcon className={className} />;
}
/* ---------- Chart ---------- */
function PipelineChart({ points }: { points: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const allZero = points.every((p) => p.value === 0);
  const W = 580, H = 170, padL = 8, padR = 8, padT = 14, padB = 24;
  const maxVal = Math.max(1, ...points.map((p) => p.value));
  const stepX = (W - padL - padR) / Math.max(1, points.length - 1);
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => H - padB - (v / maxVal) * (H - padT - padB);
  const coords = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
  const line = coords.reduce((d, c, i) => {
    if (i === 0) return `M ${c.x} ${c.y}`;
    const prev = coords[i - 1];
    const cx = (prev.x + c.x) / 2;
    return `${d} C ${cx} ${prev.y}, ${cx} ${c.y}, ${c.x} ${c.y}`;
  }, "");
  const area = coords.length ? `${line} L ${coords[coords.length - 1].x} ${H - padB} L ${coords[0].x} ${H - padB} Z` : "";

  if (allZero) {
    return (
      <div className="flex h-44 flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-accent-subtle)] text-[color:var(--content-accent)]"><EmptyChartIcon className="h-6 w-6" /></div>
        <div>
          <p dir="auto" className="t-title-3 text-[color:var(--content-primary)]">لا توجد صفقات هذا الأسبوع</p>
          <p dir="auto" className="t-body-sm mt-1 text-[color:var(--content-secondary)]">ستظهر قيمة الصفقات الجديدة هنا عند إضافتها.</p>
        </div>
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="170" onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--content-accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--content-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={padL} x2={W - padR} y1={y(maxVal * g)} y2={y(maxVal * g)} stroke="var(--border-subtle)" strokeWidth="1" />
      ))}
      {/* No draw-in: this chart sits behind a network fetch, and animating it
          after the wait only pushes the numbers further away. */}
      {area && <path d={area} fill="url(#areaGrad)" />}
      {line && <path d={line} fill="none" stroke="var(--content-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <g key={p.label}>
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--content-tertiary)">{p.label}</text>
          <circle cx={x(i)} cy={y(p.value)} r="4" fill="var(--surface-raised)" stroke="var(--content-accent)" strokeWidth="2" />
          <circle cx={x(i)} cy={y(p.value)} r="14" fill="transparent" onMouseEnter={() => setHover(i)} />
        </g>
      ))}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--content-accent)" strokeWidth="1" strokeDasharray="3 3" />
          <rect x={Math.min(Math.max(x(hover) - 46, 2), W - 94)} y={Math.max(y(points[hover].value) - 40, 2)} width="92" height="32" rx="6" fill="var(--surface-inverse)" />
          <text x={Math.min(Math.max(x(hover), 48), W - 48)} y={Math.max(y(points[hover].value) - 26, 14)} textAnchor="middle" fontSize="9" fill="var(--content-inverse-tertiary)">{points[hover].label}</text>
          <text x={Math.min(Math.max(x(hover), 48), W - 48)} y={Math.max(y(points[hover].value) - 14, 26)} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">SAR {money(points[hover].value)}</text>
        </g>
      )}
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="skeleton-shimmer h-[188px] rounded-[var(--radius-lg)]" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)]">
            <div className="flex items-center justify-between">
              <div className="skeleton-shimmer h-11 w-11 rounded-[var(--radius-lg)]" />
              <div className="skeleton-shimmer h-5 w-20 rounded-full" />
            </div>
            <div className="skeleton-shimmer mt-4 h-3.5 w-24 rounded" />
            <div className="skeleton-shimmer mt-2 h-8 w-16 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)] lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <div className="skeleton-shimmer h-10 w-10 rounded-[var(--radius-md)]" />
            <div className="skeleton-shimmer h-4 w-32 rounded" />
          </div>
          <div className="skeleton-shimmer h-40 rounded-[var(--radius-md)]" />
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="skeleton-shimmer h-10 w-10 rounded-[var(--radius-md)]" />
            <div className="skeleton-shimmer h-4 w-20 rounded" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <div className="skeleton-shimmer h-4 w-4 flex-none rounded-full" />
              <div className="skeleton-shimmer h-3.5 flex-1 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-[var(--space-card-pad)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="skeleton-shimmer h-10 w-10 rounded-[var(--radius-md)]" />
              <div className="skeleton-shimmer h-4 w-24 rounded" />
            </div>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 py-2.5">
                <div className="skeleton-shimmer h-7 w-7 flex-none rounded-full" />
                <div className="skeleton-shimmer h-3.5 flex-1 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}


/* ---------- Page ---------- */
export default function DashboardPage() {
  const toast = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [firstName, setFirstName] = useState("");
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /** Sources that failed while others succeeded — drives the partial-load notice. */
  const [partial, setPartial] = useState<string[]>([]);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [completing, setCompleting] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [{ data: user }, l, d, a, t] = await Promise.all([
        supabase.auth.getUser(),
        fetchLeadsSummary(),
        fetchDealsSummary(),
        fetchRecentActivities(5),
        fetchUpcomingTasks(5),
      ]);
      // Partial failure, not all-or-nothing. Previously any one of these four
      // rejecting blanked the whole screen — a rep lost the dashboard because
      // the tasks query timed out. Each source now fails on its own and the
      // panels that loaded still render.
      const failedSources = [
        l.error && "العملاء",
        d.error && "الصفقات",
        a.error && "النشاطات",
        t.error && "المهام",
      ].filter(Boolean) as string[];
      if (failedSources.length === 4) {
        console.error("[Dashboard] every source failed", { leads: l.error, deals: d.error, activities: a.error, tasks: t.error });
        setError(true);
        return;
      }
      if (failedSources.length) {
        console.warn("[Dashboard] partial load", failedSources);
      }
      setPartial(failedSources);
      const name = (user.user?.user_metadata?.full_name as string) || (user.user?.email ?? "").split("@")[0] || "";
      setFirstName(name.split(" ")[0]);
      setLeads((l.data as unknown as Lead[]) ?? []);
      setDeals((d.data as unknown as Deal[]) ?? []);
      setActivities((a.data as unknown as Activity[]) ?? []);
      setTasks((t.data as unknown as Task[]) ?? []);
    } catch (err) {
      console.error("[Dashboard] Unexpected error loading dashboard", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completeTask = useCallback(
    async (task: Task) => {
      if (completing.has(task.id)) return;
      setCompleting((prev) => new Set(prev).add(task.id));
      const { error: upErr } = await completeTaskQuick(String(task.id));
      if (upErr) {
        console.error("[Dashboard] Failed to complete task", upErr);
        toast("تعذّر تحديث المهمة", "error");
        setCompleting((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        return;
      }
      // Strike-through shows for a beat, then the task drops off the list.
      setTimeout(() => {
        setTasks((prev) => prev.filter((x) => x.id !== task.id));
        setCompleting((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }, 1000);
    },
    [completing, toast],
  );

  const m = useMemo(() => {
    const total_leads = leads.length;
    const clean_leads = leads.filter((l) => !l.junk_reason_id).length;
    const junk_leads = total_leads - clean_leads;
    const total_deals = deals.length;
    const won = deals.filter((d) => d.pipeline_stages?.terminal_type === "won").length;
    const lost = deals.filter((d) => d.pipeline_stages?.terminal_type === "lost").length;
    const pipeline_value = deals.reduce((s, d) => s + dealValue(d), 0);
    const win_rate = total_deals ? (won / total_deals) * 100 : 0;

    // Anchor time windows to the most recent activity so historical datasets
    // still render meaningful charts/trends instead of an always-empty week.
    const anchor = latestDate([...deals.map((d) => d.created_at), ...leads.map((l) => l.created_at)]);
    const days = last7Days(anchor);
    const series = days.map((day) => ({
      label: day.toLocaleDateString(DATE_LOCALE, { weekday: "short" }),
      value: deals.filter((d) => sameDay(d.created_at, day)).reduce((s, d) => s + dealValue(d), 0),
    }));
    const seriesRange = `${days[0].toLocaleDateString(DATE_LOCALE, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(DATE_LOCALE, { month: "short", day: "numeric" })}`;

    // Cumulative counts across the same 7-day window, for the KPI sparklines —
    // running totals (not per-day deltas) so the trend line reads as growth.
    let leadRunning = 0, cleanRunning = 0, dealRunning = 0, pipeRunning = 0;
    const leadsSeries: number[] = [];
    const cleanSeries: number[] = [];
    const dealsSeries: number[] = [];
    const pipeSeries: number[] = [];
    for (const day of days) {
      leadRunning += leads.filter((l) => sameDay(l.created_at, day)).length;
      cleanRunning += leads.filter((l) => !l.junk_reason_id && sameDay(l.created_at, day)).length;
      dealRunning += deals.filter((d) => sameDay(d.created_at, day)).length;
      pipeRunning += deals.filter((d) => sameDay(d.created_at, day)).reduce((s, d) => s + dealValue(d), 0);
      leadsSeries.push(leadRunning);
      cleanSeries.push(cleanRunning);
      dealsSeries.push(dealRunning);
      pipeSeries.push(pipeRunning);
    }

    // Recent Leads: exclude bot-stage leads (fake signups), newest first.
    const recentLeads = [...leads]
      .filter((l) => l.pipeline_stages?.terminal_type !== "bot")
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 5);

    const leadsTrend = trendText(leads.filter((l) => monthOffset(l.created_at, 0, anchor)).length, leads.filter((l) => monthOffset(l.created_at, 1, anchor)).length);
    const cleanTrend = trendText(leads.filter((l) => !l.junk_reason_id && monthOffset(l.created_at, 0, anchor)).length, leads.filter((l) => !l.junk_reason_id && monthOffset(l.created_at, 1, anchor)).length);
    const dealsTrend = trendText(deals.filter((d) => monthOffset(d.created_at, 0, anchor)).length, deals.filter((d) => monthOffset(d.created_at, 1, anchor)).length);
    const pipeTrend = trendText(deals.filter((d) => monthOffset(d.created_at, 0, anchor)).reduce((s, d) => s + dealValue(d), 0), deals.filter((d) => monthOffset(d.created_at, 1, anchor)).reduce((s, d) => s + dealValue(d), 0));
    return { total_leads, clean_leads, junk_leads, total_deals, won, lost, pipeline_value, win_rate, series, seriesRange, recentLeads, leadsTrend, cleanTrend, dealsTrend, pipeTrend, leadsSeries, cleanSeries, dealsSeries, pipeSeries };
  }, [leads, deals]);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--status-danger-bg)] text-[color:var(--status-danger-fg)]"><WifiOffIcon className="h-7 w-7" /></div>
        <div>
          <h2 className="t-title-2 text-[color:var(--content-primary)]">خطأ في الاتصال</h2>
          <p className="t-body-sm mt-1 max-w-sm text-[color:var(--content-tertiary)]">لم نتمكن من الوصول للخادم. تحقق من اتصالك وحاول مرة أخرى.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="t-body-sm rounded-[var(--radius-md)] bg-[var(--surface-accent)] px-5 py-2.5 font-semibold text-[color:var(--content-on-accent)] transition-colors hover:bg-[var(--surface-accent-hover)]"
        >إعادة المحاولة</button>
      </div>
    );
  }

  // One accent, not four. The KPI tiles previously carried a different hue
  // each, which made the row read as a colour chart rather than a number row.
  // Semantic colour is reserved for the trend, where up/down actually means
  // something.
  const kpis = [
    { label: "إجمالي العملاء", n: m.total_leads, format: (v: number) => String(Math.round(v)), Icon: LeadsIcon, trend: m.leadsTrend, href: "/dashboard/leads", spark: m.leadsSeries },
    { label: "عملاء نظيفون", n: m.clean_leads, format: (v: number) => String(Math.round(v)), Icon: CheckCircleIcon, trend: m.cleanTrend, href: "/dashboard/leads?filter=clean", spark: m.cleanSeries },
    { label: "صفقات نشطة", n: m.total_deals, format: (v: number) => String(Math.round(v)), Icon: RevenueIcon, trend: m.dealsTrend, href: "/dashboard/deals?filter=active", spark: m.dealsSeries },
    { label: "قيمة الصفقات", n: m.pipeline_value, format: (v: number) => `SAR ${compactSAR(v)}`, Icon: TrendingUpIcon, trend: m.pipeTrend, href: "/dashboard/insights", spark: m.pipeSeries },
  ];

  const overview = [
    { tone: "accent" as const, label: "قيمة الصفقات", value: `SAR ${money(m.pipeline_value)}` },
    { tone: "success" as const, label: "عملاء نظيفون", value: m.clean_leads },
    { tone: "danger" as const, label: "عملاء غير مؤهلين", value: m.junk_leads },
  ];

  return (
    <div className="flex flex-col gap-[var(--space-card-gap)]">
      {/* The KPI row lives inside the navy band rather than as four more white
          cards below it. That is the Meridian read: dark structure carrying
          the summary, ivory surfaces carrying the detail. */}
      <CommandBand
        icon={<span className="t-title-3 font-bold text-[color:var(--content-inverse-accent)]">{initials(firstName || "أنت")}</span>}
        title={`${greeting()}، ${firstName || "بك"}`}
        subtitle={
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {longDate(now)}
          </span>
        }
        actions={
          <>
            <BandButton onClick={() => setNewLeadOpen(true)}>+ عميل جديد</BandButton>
            <BandButton variant="ghost" onClick={() => setLogActivityOpen(true)}>تسجيل نشاط</BandButton>
            <BandButton variant="ghost" onClick={() => setAddContactOpen(true)}>إضافة جهة اتصال</BandButton>
          </>
        }
        footer={
          <div className="grid grid-cols-1 divide-y divide-[var(--border-inverse)] sm:grid-cols-2 sm:divide-y-0 md:grid-cols-4">
            {kpis.map(({ label, n, format, Icon, trend, href, spark }, i) => (
              <Link
                key={label}
                href={href}
                className={`group flex flex-col gap-2 px-6 py-5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-white/[0.05] ${
                  i > 0 ? "sm:border-s sm:border-[var(--border-inverse)]" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-[color:var(--content-inverse-tertiary)]">
                  <Icon className="h-4 w-4" />
                  <span className="t-caption font-semibold">{label}</span>
                </span>
                <span className="t-figure t-figure-md leading-none text-[color:var(--content-inverse-primary)]">
                  <CountUp value={n} format={format} />
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className={`t-micro flex items-center gap-1 font-bold ${TREND_ON_NAVY[trend.dir]}`}>
                    {trend.dir === "up" && <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5"><path d="M6 2l4 5H7v3H5V7H2z" /></svg>}
                    {trend.dir === "down" && <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5"><path d="M6 10 2 5h3V2h2v3h3z" /></svg>}
                    {trend.text}
                  </span>
                  {spark.length >= 2 && <Sparkline values={spark} color="var(--brand-teal-300)" width={64} height={20} />}
                </span>
              </Link>
            ))}
          </div>
        }
      />

      {partial.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-md)] border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3"
        >
          <AlertIcon className="h-4 w-4 flex-none text-[color:var(--status-warning-fg)]" />
          <p className="t-body-sm text-[color:var(--status-warning-fg)]">
            تعذّر تحميل: {partial.join("، ")} — بقية اللوحة محدّثة.
          </p>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="t-caption font-bold text-[color:var(--status-warning-fg)] underline underline-offset-2"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      <LedgerSection label="النشاط" meta={m.seriesRange}>
      <div className="grid grid-cols-1 gap-[var(--space-card-gap)] lg:grid-cols-3">
        <Panel className="p-[var(--space-card-pad)] lg:col-span-2">
          <PanelHead
            icon={<ChartBarIcon className="h-5 w-5" />}
            title="نشاط الصفقات"
            subtitle={`قيمة الصفقات · ${m.seriesRange}`}
            action={<span className="t-micro rounded-full bg-[var(--surface-sunken)] px-3 py-1 font-bold text-[color:var(--content-tertiary)]">آخر ٧ أيام</span>}
            className="mb-4"
          />
          <PipelineChart points={m.series} />
          <div className="mt-4 flex gap-8 border-t border-[var(--border-subtle)] pt-4">
            <div><p className="t-figure t-title-3 text-[color:var(--content-primary)]">{m.total_deals}</p><p className="t-caption text-[color:var(--content-tertiary)]">إجمالي الصفقات</p></div>
            <div><p className="t-figure t-title-3 text-[color:var(--status-success-fg)]">{m.won}</p><p className="t-caption text-[color:var(--content-tertiary)]">مكسوبة</p></div>
            <div><p className="t-figure t-title-3 text-[color:var(--status-danger-fg)]">{m.lost}</p><p className="t-caption text-[color:var(--content-tertiary)]">خاسرة</p></div>
          </div>
        </Panel>

        <Panel className="flex flex-col p-[var(--space-card-pad)]">
          <PanelHead
            icon={<ClockIcon className="h-5 w-5" />}
            title="اليوم"
            subtitle={longDate(now)}
            action={
              <p className="t-figure rounded-[var(--radius-sm)] bg-[var(--surface-accent-subtle)] px-3 py-1.5 t-body-lg text-[color:var(--content-accent)]">
                {now.toLocaleTimeString(DATE_LOCALE, { hour: "2-digit", minute: "2-digit" })}
              </p>
            }
            className="mb-4"
          />
          <div className="flex-1 border-t border-[var(--border-subtle)] pt-4">
            <p className="t-eyebrow mb-3 text-[color:var(--content-tertiary)]">المهام القادمة</p>
            {tasks.length === 0 ? (
              <p className="t-body-sm flex items-center justify-center gap-2 py-6 text-center text-[color:var(--content-tertiary)]">
                <CelebrationIcon className="h-4 w-4 text-[color:var(--content-accent)]" />لا مهام لليوم!
              </p>
            ) : (
              tasks.map((t) => {
                const done = completing.has(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-3 border-b border-[var(--border-subtle)] py-2.5 last:border-0">
                    <button
                      type="button"
                      onClick={() => completeTask(t)}
                      aria-label={`إنهاء المهمة: ${taskTitle(t)}`}
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-[var(--motion-fast)] ${
                        done
                          ? "border-[var(--content-accent)] bg-[var(--content-accent)] text-white"
                          : "border-[var(--border-strong)] hover:border-[var(--content-accent)]"
                      }`}
                    >
                      {done && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                    <span dir="auto" className={`t-body-sm flex-1 truncate transition-colors ${done ? "text-[color:var(--content-tertiary)] line-through" : "text-[color:var(--content-secondary)]"}`}>
                      {taskTitle(t)}
                    </span>
                    <span className="t-caption tabular-nums text-[color:var(--content-tertiary)]">{timeOf(t.due_at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      </LedgerSection>

      <LedgerSection label="التفاصيل" meta={`${m.total_deals} صفقة`}>
      <div className="grid grid-cols-1 gap-[var(--space-card-gap)] lg:grid-cols-3">
        {/* Sales overview */}
        <Panel className="p-[var(--space-card-pad)]">
          <PanelHead icon={<TargetIcon className="h-5 w-5" />} title="ملخص المبيعات" className="mb-4" />

          <div className="mb-5 flex items-center gap-5 border-b border-[var(--border-subtle)] pb-5">
            <div className="relative h-28 w-28 flex-none">
              <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90" role="img" aria-label={`نسبة الفوز ${m.win_rate.toFixed(0)} بالمئة`}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-sunken)" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none" stroke="var(--status-danger-fg)" strokeWidth="12" strokeLinecap="round" opacity="0.8"
                  strokeDasharray={`${m.total_deals ? (m.lost / m.total_deals) * 314.16 : 0} 314.16`}
                />
                <circle
                  cx="60" cy="60" r="50" fill="none" stroke="var(--content-accent)" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${(Math.min(100, m.win_rate) / 100) * 314.16} 314.16`}
                  style={{ transition: "stroke-dasharray var(--motion-slow) var(--ease-standard)" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="t-figure t-figure-sm leading-none text-[color:var(--content-primary)]">{m.win_rate.toFixed(0)}%</span>
                <span className="t-micro mt-1 font-semibold text-[color:var(--content-tertiary)]">نسبة الفوز</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--status-success-bg)] px-3 py-2">
                <span className="t-caption flex items-center gap-1.5 font-semibold text-[color:var(--status-success-fg)]"><span className="h-2 w-2 rounded-full bg-current" />مكسوبة</span>
                <span className="t-figure t-body text-[color:var(--status-success-fg)]">{m.won}</span>
              </div>
              <div className="flex items-center justify-between rounded-[var(--radius-sm)] bg-[var(--status-danger-bg)] px-3 py-2">
                <span className="t-caption flex items-center gap-1.5 font-semibold text-[color:var(--status-danger-fg)]"><span className="h-2 w-2 rounded-full bg-current" />خاسرة</span>
                <span className="t-figure t-body text-[color:var(--status-danger-fg)]">{m.lost}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            {overview.map((o) => (
              <div key={o.label} className="flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-2 transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]">
                <div className="flex items-center gap-2.5">
                  <div className={`h-2 w-2 flex-none rounded-full ${OVERVIEW_DOT[o.tone]}`} />
                  <span className="t-body-sm text-[color:var(--content-secondary)]">{o.label}</span>
                </div>
                <span className={`t-figure rounded-[var(--radius-xs)] px-2 py-0.5 t-body-sm ${OVERVIEW_BADGE[o.tone]}`}>{o.value}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Activity feed */}
        <Panel className="p-[var(--space-card-pad)]">
          <PanelHead
            icon={<ActivitiesIcon className="h-5 w-5" />}
            title="آخر النشاطات"
            action={<Link href="/dashboard/activities" className="t-caption font-semibold text-[color:var(--content-accent)] hover:underline">عرض الكل ←</Link>}
            className="mb-4"
          />
          {activities.length === 0 ? (
            <p className="t-body-sm py-6 text-center text-[color:var(--content-tertiary)]">لا توجد نشاطات مسجلة</p>
          ) : (
            (() => {
              const groups: { key: string; header: string; items: Activity[] }[] = [];
              for (const a of activities) {
                const k = dayKey(a.occurred_at);
                let g = groups.find((x) => x.key === k);
                if (!g) { g = { key: k, header: dayHeader(a.occurred_at), items: [] }; groups.push(g); }
                g.items.push(a);
              }
              return groups.map((g) => (
                <div key={g.key}>
                  <p className="t-eyebrow mb-1 inline-block rounded-full bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[color:var(--content-tertiary)]">{g.header}</p>
                  <div className="relative">
                    {g.items.length > 1 && <span className="absolute inset-y-1 right-[13px] w-px bg-[var(--border-subtle)]" />}
                    {g.items.map((a) => (
                      <div key={a.id} className="relative flex gap-3 rounded-[var(--radius-sm)] px-1 py-2.5 transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]">
                        <span className="relative z-10 mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--surface-accent-subtle)] text-[color:var(--content-accent)] ring-4 ring-[var(--surface-raised)]">
                          <ActivityGlyph label={a.activity_types?.label} className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p dir="auto" className="t-body-sm line-clamp-2 text-[color:var(--content-secondary)]">{a.body || a.activity_types?.label || "نشاط"}</p>
                          <span className="t-caption text-[color:var(--content-tertiary)]">{formatDateTime(a.occurred_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()
          )}
        </Panel>

        {/* Recent leads */}
        <Panel className="p-[var(--space-card-pad)]">
          <PanelHead
            icon={<LeadsIcon className="h-5 w-5" />}
            title="أحدث العملاء"
            action={<Link href="/dashboard/leads" className="t-caption font-semibold text-[color:var(--content-accent)] hover:underline">عرض الكل ←</Link>}
            className="mb-4"
          />
          {m.recentLeads.length === 0 ? (
            <div className="py-6 text-center">
              <p className="t-body-sm text-[color:var(--content-tertiary)]">لا يوجد عملاء بعد — أضف أول عميل</p>
              <button onClick={() => setNewLeadOpen(true)} className="t-caption mt-3 rounded-full bg-[var(--surface-accent)] px-4 py-2 font-semibold text-[color:var(--content-on-accent)] transition-colors hover:bg-[var(--surface-accent-hover)]">+ عميل جديد</button>
            </div>
          ) : (
            m.recentLeads.map((l) => (
                <Link key={l.id} href={`/dashboard/leads?open=${l.id}`} className="flex items-center gap-3 rounded-[var(--radius-sm)] px-1 py-2.5 transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]">
                  {/* One avatar treatment. The five-gradient rotation it replaces
                      encoded nothing — position in a list is not an attribute. */}
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-inverse)]">
                    <span className="t-micro font-bold text-white">{initials(l.full_name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="t-body-sm truncate font-semibold text-[color:var(--content-primary)]">{l.full_name || "عميل بدون اسم"}</p>
                    <p className="t-caption text-[color:var(--content-tertiary)]">{l.sources?.label || "—"}</p>
                  </div>
                  <span className="t-caption flex-none text-[color:var(--content-tertiary)]">{formatDate(l.created_at)}</span>
                </Link>
            ))
          )}
        </Panel>
      </div>

      </LedgerSection>

      <NewLeadSlideOver open={newLeadOpen} onClose={() => setNewLeadOpen(false)} onCreated={load} />
      <LogActivitySlideOver open={logActivityOpen} onClose={() => setLogActivityOpen(false)} onCreated={load} />
      <AddContactSlideOver open={addContactOpen} onClose={() => setAddContactOpen(false)} onCreated={load} />
    </div>
  );
}
