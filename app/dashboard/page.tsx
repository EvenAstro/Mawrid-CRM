"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LeadsIcon, CheckCircleIcon, RevenueIcon, TrendingUpIcon } from "@/components/navIcons";
import { useToast } from "@/components/Toast";
import NewLeadSlideOver from "@/components/NewLeadSlideOver";
import LogActivitySlideOver from "@/components/LogActivitySlideOver";
import AddContactSlideOver from "@/components/AddContactSlideOver";
import { dayHeader, dayKey, formatDateTime } from "@/lib/format";

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
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function dateTimeNice(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
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
function trendText(cur: number, prev: number): { text: string; cls: string } {
  if (prev === 0) return { text: "أول شهر", cls: "text-[#94a3b8]" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: "No change from last month", cls: "text-[#94a3b8]" };
  if (pct > 0) return { text: `↑ ${pct}% from last month`, cls: "text-[#10b981]" };
  return { text: `↓ ${Math.abs(pct)}% from last month`, cls: "text-[#ef4444]" };
}
function initials(name: string | null | undefined) {
  if (!name) return "—";
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
}
function taskTitle(t: Task) {
  return t.title || t.name || "Untitled task";
}
const nf = new Intl.NumberFormat("en-US");
const money = (n: number) => nf.format(Math.round(n));
function compactSAR(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(Math.round(n));
}
const AI_SOURCE_RATES: Record<string, number> = {
  "Employee Referral": 0.0, "Partner Referral": 0.0, Snapchat: 0.388, TikTok: 0.667, Website: 0.75, Instagram: 0.805,
};
function getAIScore(lead: Lead): number {
  const source = lead.sources?.label || "Instagram";
  let p = AI_SOURCE_RATES[source] ?? 0.5;
  if (lead.establishment_id) p *= 0.05;
  p = Math.min(1, Math.max(0, p));
  return Math.round((1 - p) * 100);
}
function activityColor(label?: string | null) {
  const l = (label || "").toLowerCase();
  if (l.includes("whatsapp")) return "#10b981";
  if (l.includes("call")) return "#1a5c4f";
  if (l.includes("email")) return "#8b5cf6";
  if (l.includes("deal") || l.includes("meeting")) return "#f59e0b";
  return "#1a5c4f";
}
function activityGlyph(label?: string | null) {
  const l = (label || "").toLowerCase();
  if (l.includes("whatsapp")) return "💬";
  if (l.includes("call")) return "📞";
  if (l.includes("email")) return "✉️";
  if (l.includes("meeting")) return "🗓️";
  return "•";
}
function aiPill(score: number) {
  if (score >= 70) return "bg-green-50 text-green-700 border border-green-100";
  if (score >= 40) return "bg-amber-50 text-amber-700 border border-amber-100";
  return "bg-red-50 text-red-700 border border-red-100";
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
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f0faf8] text-2xl">📊</div>
        <div>
          <p dir="auto" className="text-[18px] font-semibold text-[#1e1b4b]">لا توجد صفقات هذا الأسبوع</p>
          <p dir="auto" className="mt-1 text-sm text-[#3f554e]">ستظهر قيمة الصفقات الجديدة هنا عند إضافتها.</p>
        </div>
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="170" onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5c4f" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#1a5c4f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={padL} x2={W - padR} y1={y(maxVal * g)} y2={y(maxVal * g)} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      {area && <path d={area} fill="url(#areaGrad)" />}
      {line && <path d={line} fill="none" stroke="#1a5c4f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <g key={p.label}>
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text>
          <circle cx={x(i)} cy={y(p.value)} r="4" fill="white" stroke="#1a5c4f" strokeWidth="2" />
          <circle cx={x(i)} cy={y(p.value)} r="14" fill="transparent" onMouseEnter={() => setHover(i)} />
        </g>
      ))}
      {hover != null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="#1a5c4f" strokeWidth="1" strokeDasharray="3 3" />
          <rect x={Math.min(Math.max(x(hover) - 46, 2), W - 94)} y={Math.max(y(points[hover].value) - 40, 2)} width="92" height="32" rx="6" fill="#1e1b4b" />
          <text x={Math.min(Math.max(x(hover), 48), W - 48)} y={Math.max(y(points[hover].value) - 26, 14)} textAnchor="middle" fontSize="9" fill="#a5b4c9">{points[hover].label}</text>
          <text x={Math.min(Math.max(x(hover), 48), W - 48)} y={Math.max(y(points[hover].value) - 14, 26)} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">SAR {money(points[hover].value)}</text>
        </g>
      )}
    </svg>
  );
}

function Skeleton() {
  const box = "animate-pulse rounded-2xl bg-white";
  return (
    <div className="flex flex-col gap-6">
      <div className="h-9 w-64 animate-pulse rounded-lg bg-white" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${box} h-36 border border-[#e8ece9]`} />)}</div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3"><div className={`${box} h-80 border border-[#e8ece9] lg:col-span-2`} /><div className={`${box} h-80 border border-[#e8ece9]`} /></div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${box} h-64 border border-[#e8ece9]`} />)}</div>
    </div>
  );
}

const CARD = "rounded-2xl border border-[#e8ece9] bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md";

/* ---------- Page ---------- */
export default function DashboardPage() {
  const toast = useToast();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [firstName, setFirstName] = useState("");
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
        supabase.from("leads").select("*, sources(label), pipeline_stages(label, terminal_type)").is("deleted_at", null),
        supabase.from("deals").select("*, pipeline_stages(label, terminal_type)").is("deleted_at", null),
        supabase.from("activities").select("*, activity_types(label)").order("occurred_at", { ascending: false }).limit(5),
        supabase.from("tasks").select("*").is("completed_at", null).order("due_at", { ascending: true }).limit(5),
      ]);
      const firstErr = l.error || d.error || a.error || t.error;
      if (firstErr) {
        console.error("[Dashboard] Supabase fetch failed", { leads: l.error, deals: d.error, activities: a.error, tasks: t.error });
        setError(true);
        return;
      }
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
      const { error: upErr } = await supabase
        .from("tasks")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", task.id);
      if (upErr) {
        console.error("[Dashboard] Failed to complete task", upErr);
        toast("Could not update task", "error");
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
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      value: deals.filter((d) => sameDay(d.created_at, day)).reduce((s, d) => s + dealValue(d), 0),
    }));
    const seriesRange = `${days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

    // Recent Leads: exclude bot-stage leads (fake signups), newest first.
    const recentLeads = [...leads]
      .filter((l) => l.pipeline_stages?.terminal_type !== "bot")
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 5);

    const leadsTrend = trendText(leads.filter((l) => monthOffset(l.created_at, 0, anchor)).length, leads.filter((l) => monthOffset(l.created_at, 1, anchor)).length);
    const cleanTrend = trendText(leads.filter((l) => !l.junk_reason_id && monthOffset(l.created_at, 0, anchor)).length, leads.filter((l) => !l.junk_reason_id && monthOffset(l.created_at, 1, anchor)).length);
    const dealsTrend = trendText(deals.filter((d) => monthOffset(d.created_at, 0, anchor)).length, deals.filter((d) => monthOffset(d.created_at, 1, anchor)).length);
    const pipeTrend = trendText(deals.filter((d) => monthOffset(d.created_at, 0, anchor)).reduce((s, d) => s + dealValue(d), 0), deals.filter((d) => monthOffset(d.created_at, 1, anchor)).reduce((s, d) => s + dealValue(d), 0));
    return { total_leads, clean_leads, junk_leads, total_deals, won, lost, pipeline_value, win_rate, series, seriesRange, recentLeads, leadsTrend, cleanTrend, dealsTrend, pipeTrend };
  }, [leads, deals]);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">🔌</div>
        <div>
          <h2 className="text-xl font-bold text-[#1e1b4b]">Connection error</h2>
          <p className="mt-1 max-w-sm text-sm text-[#94a3b8]">
            We couldn&apos;t reach the server. Check your connection and try again.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="rounded-xl bg-[#1a5c4f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#1a5c4f]/20 transition hover:bg-[#15503f]"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = [
    { label: "Total Leads", value: String(m.total_leads), Icon: LeadsIcon, color: "#1a5c4f", trend: m.leadsTrend, href: "/dashboard/leads" },
    { label: "Clean Leads", value: String(m.clean_leads), Icon: CheckCircleIcon, color: "#10b981", trend: m.cleanTrend, href: "/dashboard/leads?filter=clean" },
    { label: "Active Deals", value: String(m.total_deals), Icon: RevenueIcon, color: "#f59e0b", trend: m.dealsTrend, href: "/dashboard/deals?filter=active" },
    { label: "Pipeline Value", value: `SAR ${compactSAR(m.pipeline_value)}`, Icon: TrendingUpIcon, color: "#6366f1", trend: m.pipeTrend, href: "/dashboard/analytics" },
  ];

  const overview = [
    { dot: "#1a5c4f", label: "Pipeline Value", value: `SAR ${money(m.pipeline_value)}`, badge: "bg-[#f0faf8] text-[#1a5c4f]" },
    { dot: "#10b981", label: "Won Deals", value: m.won, badge: "bg-green-50 text-green-700" },
    { dot: "#ef4444", label: "Lost Deals", value: m.lost, badge: "bg-red-50 text-red-700" },
    { dot: "#10b981", label: "Clean Leads", value: m.clean_leads, badge: "bg-green-50 text-green-700" },
    { dot: "#ef4444", label: "Junk Leads", value: m.junk_leads, badge: "bg-red-50 text-red-700" },
    { dot: "#94a3b8", label: "Open Tickets", value: 11, badge: "bg-[#f1f5f9] text-[#334155]" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 dir="auto" className="text-[28px] font-bold tracking-[-0.02em] text-[#1e1b4b]">{greeting()}، {firstName || "بك"} 👋</h1>
          <p className="mt-1 text-sm text-[#94a3b8]">{longDate(now)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setNewLeadOpen(true)} className="rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(26,92,79,0.25)] transition-all hover:scale-[1.02]">+ New Lead</button>
          <button onClick={() => setLogActivityOpen(true)} className="rounded-full border-2 border-[#1a5c4f] bg-white px-5 py-2.5 text-sm font-semibold text-[#1a5c4f] transition-all hover:bg-[#f0faf8]">Log Activity</button>
          <button onClick={() => setAddContactOpen(true)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-[#334155] transition-all hover:bg-[#f0faf8] hover:text-[#1a5c4f]">Add Contact</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, Icon, color, trend, href }) => (
          <Link key={label} href={href} className="group relative overflow-hidden rounded-2xl border border-[#e8efed] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.06),0_12px_32px_rgba(0,0,0,0.04)]">
            <span className="absolute bottom-4 left-0 top-4 w-1 rounded-full" style={{ background: color }} />
            <span className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-105" style={{ backgroundColor: `${color}1a`, color }}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</p>
            <p className="mb-2 mt-3 text-[44px] font-black leading-none text-[#1e1b4b]">{value}</p>
            <p className={`text-xs font-semibold ${trend.cls}`}>{trend.text}</p>
          </Link>
        ))}
      </div>

      {/* Middle row */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={`${CARD} lg:col-span-2`}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1e1b4b]">Pipeline Activity</h3>
              <p className="mt-0.5 text-sm text-[#94a3b8]">Deal value · {m.seriesRange}</p>
            </div>
            <span className="rounded-full border border-[#e8ece9] bg-[#f8fafc] px-3 py-1 text-xs text-[#94a3b8]">Last 7 days</span>
          </div>
          <PipelineChart points={m.series} />
          <div className="mt-4 flex gap-8 border-t border-[#f1f5f9] pt-4">
            <div><p className="text-lg font-bold text-[#1e1b4b]">{m.total_deals}</p><p className="text-xs text-[#94a3b8]">Total Deals</p></div>
            <div><p className="text-lg font-bold text-green-600">{m.won}</p><p className="text-xs text-[#94a3b8]">Won</p></div>
            <div><p className="text-lg font-bold text-red-600">{m.lost}</p><p className="text-xs text-[#94a3b8]">Lost</p></div>
          </div>
        </div>

        <div className={`${CARD} flex flex-col`}>
          <h3 className="mb-1 text-base font-bold text-[#1e1b4b]">Today</h3>
          <p className="text-4xl font-black tabular-nums text-[#1a5c4f]">{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
          <p className="mb-4 text-sm text-[#94a3b8]">{longDate(now)}</p>
          <div className="flex-1 border-t border-[#f1f5f9] pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">Upcoming Tasks</p>
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#94a3b8]">🎉 All clear for today!</p>
            ) : (
              tasks.map((t) => {
                const done = completing.has(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-3 border-b border-[#f1f5f9] py-2.5 last:border-0">
                    <button
                      type="button"
                      onClick={() => completeTask(t)}
                      aria-label="Mark task complete"
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        done ? "border-[#1a5c4f] bg-[#1a5c4f] text-white" : "border-[#e8ece9] hover:border-[#1a5c4f]"
                      }`}
                    >
                      {done && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                    <span dir="auto" className={`flex-1 truncate text-sm transition-colors ${done ? "text-[#94a3b8] line-through" : "text-[#334155]"}`}>
                      {taskTitle(t)}
                    </span>
                    <span className="text-xs text-[#94a3b8]">{timeOf(t.due_at)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent Leads */}
        <div className={CARD}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1e1b4b]">Recent Leads</h3>
            <Link href="/dashboard/leads" className="text-xs font-semibold text-[#1a5c4f] hover:underline">View all →</Link>
          </div>
          {m.recentLeads.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-[#94a3b8]">No leads yet — add your first lead</p>
              <button onClick={() => setNewLeadOpen(true)} className="mt-3 rounded-full bg-[#1a5c4f] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#15503f]">+ New Lead</button>
            </div>
          ) : (
            m.recentLeads.map((l) => {
              const score = getAIScore(l);
              return (
                <Link key={l.id} href={`/dashboard/leads?open=${l.id}`} className="flex items-center gap-3 border-b border-[#f1f5f9] py-2.5 transition-colors last:border-0 hover:bg-[#f0faf8]">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1a5c4f]">
                    <span className="text-xs font-bold text-white">{initials(l.full_name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-sm font-semibold text-[#1e1b4b]">{l.full_name || "Unnamed lead"}</p>
                    <p className="text-xs text-[#94a3b8]">{l.sources?.label || "—"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${aiPill(score)}`}>{score}%</span>
                </Link>
              );
            })
          )}
        </div>

        {/* Activity Feed */}
        <div className={CARD}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-[#1e1b4b]">Activity Feed</h3>
            <Link href="/dashboard/activities" className="text-xs font-semibold text-[#1a5c4f] hover:underline">View all →</Link>
          </div>
          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#94a3b8]">No activities recorded</p>
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
                  <p className="sticky top-0 bg-white py-1 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">{g.header}</p>
                  {g.items.map((a) => {
                    const c = activityColor(a.activity_types?.label);
                    return (
                      <div key={a.id} className="flex gap-3 py-2.5">
                        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs" style={{ backgroundColor: `${c}1a`, color: c }}>{activityGlyph(a.activity_types?.label)}</span>
                        <div className="min-w-0 flex-1">
                          <p dir="auto" className="line-clamp-2 text-sm leading-relaxed text-[#475569]">{a.body || a.activity_types?.label || "Activity"}</p>
                          <span className="text-xs text-[#94a3b8]">{formatDateTime(a.occurred_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>

        {/* Sales Overview */}
        <div className={CARD}>
          <h3 className="mb-4 text-base font-bold text-[#1e1b4b]">Sales Overview</h3>
          {overview.map((o) => (
            <div key={o.label} className="flex items-center justify-between border-b border-[#f1f5f9] py-2.5 last:border-0">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: o.dot }} />
                <span className="text-sm text-[#334155]">{o.label}</span>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${o.badge}`}>{o.value}</span>
            </div>
          ))}
          <div className="mt-4 border-t border-[#f1f5f9] pt-4">
            <div className="mb-2 flex justify-between text-xs text-[#94a3b8]">
              <span>Win Rate</span>
              <span className="font-semibold text-[#334155]">{m.win_rate.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#f1f5f9]">
              <div className="h-full rounded-full bg-[#1a5c4f]" style={{ width: `${Math.min(100, m.win_rate)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <NewLeadSlideOver open={newLeadOpen} onClose={() => setNewLeadOpen(false)} onCreated={load} />
      <LogActivitySlideOver open={logActivityOpen} onClose={() => setLogActivityOpen(false)} onCreated={load} />
      <AddContactSlideOver open={addContactOpen} onClose={() => setAddContactOpen(false)} onCreated={load} />
    </div>
  );
}
