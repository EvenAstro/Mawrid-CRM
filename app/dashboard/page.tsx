"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LeadsIcon, CheckCircleIcon, RevenueIcon, TrendingUpIcon } from "@/components/navIcons";
import { useToast } from "@/components/Toast";
import NewLeadSlideOver from "@/components/NewLeadSlideOver";
import LogActivitySlideOver from "@/components/LogActivitySlideOver";
import AddContactSlideOver from "@/components/AddContactSlideOver";
import { dayHeader, dayKey, formatDateTime, initials, money, compactSAR } from "@/lib/format";
import { fetchLeadScoreModel, getAIScore, type LeadScoreModel } from "@/lib/leadScore/computeLeadScore";

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
  return d.toLocaleDateString("ar-SA", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
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
function trendText(cur: number, prev: number): { text: string; cls: string; dir: "up" | "down" | "flat" } {
  if (prev === 0 && cur === 0) return { text: "لا بيانات بعد", cls: "text-[#94a3b8]", dir: "flat" };
  if (prev === 0) return { text: "أول شهر", cls: "text-[#94a3b8]", dir: "flat" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: "بدون تغيير", cls: "text-[#94a3b8]", dir: "flat" };
  if (pct > 0) return { text: `${pct}% عن الشهر الماضي`, cls: "text-[#10b981]", dir: "up" };
  return { text: `${Math.abs(pct)}% عن الشهر الماضي`, cls: "text-[#ef4444]", dir: "down" };
}
function taskTitle(t: Task) {
  return t.title || t.name || "مهمة بدون عنوان";
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
const AVATAR_GRADIENTS = [
  "from-[#1a5c4f] to-[#0f3a30]",
  "from-[#6366f1] to-[#4338ca]",
  "from-[#f59e0b] to-[#c2660a]",
  "from-[#0ea5e9] to-[#0369a1]",
  "from-[#ec4899] to-[#be185d]",
];

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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${box} h-36 border border-[#d6ece5]`} />)}</div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3"><div className={`${box} h-80 border border-[#d6ece5] lg:col-span-2`} /><div className={`${box} h-80 border border-[#d6ece5]`} /></div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${box} h-64 border border-[#d6ece5]`} />)}</div>
    </div>
  );
}

const CARD = "rounded-2xl border border-[#d6ece5] bg-white p-6 shadow-[0_2px_8px_rgba(26,92,79,0.04)] transition-all duration-200 hover:shadow-[0_4px_16px_rgba(26,92,79,0.08)]";

function CardHead({ icon, color, title, subtitle, action }: { icon: React.ReactNode; color: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ backgroundColor: `${color}17`, color }}>
          {icon}
        </span>
        <div>
          <h3 className="text-[16px] font-bold tracking-[-0.01em] text-[#1e1b4b]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-[#94a3b8]">{subtitle}</p>}
        </div>
      </div>
      {action}
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
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [completing, setCompleting] = useState<Set<string | number>>(new Set());
  const [scoreModel, setScoreModel] = useState<LeadScoreModel | null>(null);

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
      fetchLeadScoreModel()
        .then(setScoreModel)
        .catch((err) => console.error("[Dashboard] lead score model failed", err));
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
      label: day.toLocaleDateString("ar-SA", { weekday: "short" }),
      value: deals.filter((d) => sameDay(d.created_at, day)).reduce((s, d) => s + dealValue(d), 0),
    }));
    const seriesRange = `${days[0].toLocaleDateString("ar-SA", { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}`;

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
          <h2 className="text-xl font-bold text-[#1e1b4b]">خطأ في الاتصال</h2>
          <p className="mt-1 max-w-sm text-sm text-[#94a3b8]">
            لم نتمكن من الوصول للخادم. تحقق من اتصالك وحاول مرة أخرى.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="rounded-xl bg-[#1a5c4f] px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#1a5c4f]/20 transition hover:bg-[#15503f]"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const kpis = [
    { label: "إجمالي العملاء", value: String(m.total_leads), Icon: LeadsIcon, color: "#1a5c4f", trend: m.leadsTrend, href: "/dashboard/leads" },
    { label: "عملاء نظيفون", value: String(m.clean_leads), Icon: CheckCircleIcon, color: "#10b981", trend: m.cleanTrend, href: "/dashboard/leads?filter=clean" },
    { label: "صفقات نشطة", value: String(m.total_deals), Icon: RevenueIcon, color: "#f59e0b", trend: m.dealsTrend, href: "/dashboard/deals?filter=active" },
    { label: "قيمة الصفقات", value: `SAR ${compactSAR(m.pipeline_value)}`, Icon: TrendingUpIcon, color: "#6366f1", trend: m.pipeTrend, href: "/dashboard/insights" },
  ];

  const overview = [
    { dot: "#1a5c4f", label: "قيمة الصفقات", value: `SAR ${money(m.pipeline_value)}`, badge: "bg-[#f0faf8] text-[#1a5c4f]" },
    { dot: "#10b981", label: "عملاء نظيفون", value: m.clean_leads, badge: "bg-green-50 text-green-700" },
    { dot: "#ef4444", label: "عملاء غير مؤهلين", value: m.junk_leads, badge: "bg-red-50 text-red-700" },
  ];

  return (
    <div>
      {/* Hero header */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#141c2e] via-[#173226] to-[#0f3a30] px-7 py-7 shadow-[0_16px_40px_rgba(15,58,48,0.25)]">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#38d39f] opacity-[0.12] blur-[70px]" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-[#60a5fa] opacity-[0.08] blur-[60px]" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/10 text-lg font-bold text-white ring-1 ring-white/15 backdrop-blur-sm">
              {initials(firstName || "أنت")}
            </div>
            <div>
              <h1 dir="auto" className="text-[26px] font-bold tracking-[-0.02em] text-white">{greeting()}، {firstName || "بك"}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/50">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-3.5 w-3.5"><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" /></svg>
                {longDate(now)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setNewLeadOpen(true)} className="rounded-xl bg-[#38d39f] px-6 py-2.5 text-sm font-bold text-[#0f3a30] shadow-[0_4px_16px_rgba(56,211,159,0.3)] transition-all hover:-translate-y-px hover:bg-[#4fdcae]">+ عميل جديد</button>
            <button onClick={() => setLogActivityOpen(true)} className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/90 backdrop-blur-sm transition-all hover:bg-white/[0.12]">تسجيل نشاط</button>
            <button onClick={() => setAddContactOpen(true)} className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/90 backdrop-blur-sm transition-all hover:bg-white/[0.12]">إضافة جهة اتصال</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label, value, Icon, color, trend, href }) => (
          <Link key={label} href={href} className="group relative overflow-hidden rounded-2xl border border-[#d6ece5] p-6 shadow-[0_2px_8px_rgba(26,92,79,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-transparent hover:shadow-[0_10px_28px_rgba(26,92,79,0.14)]" style={{ background: `linear-gradient(155deg, ${color}0f 0%, #fff 55%)` }}>
            <span className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full opacity-[0.1] transition-transform duration-300 group-hover:scale-125" style={{ background: color }} />
            <div className="relative flex items-center justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105" style={{ backgroundColor: color, color: "#fff" }}>
                <Icon className="h-5 w-5" />
              </span>
              <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${trend.dir === "up" ? "bg-emerald-50" : trend.dir === "down" ? "bg-red-50" : "bg-[#f1f5f9]"} ${trend.cls}`}>
                {trend.dir === "up" && <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5"><path d="M6 2l4 5H7v3H5V7H2z" /></svg>}
                {trend.dir === "down" && <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5"><path d="M6 10 2 5h3V2h2v3h3z" /></svg>}
                {trend.text}
              </span>
            </div>
            <p className="relative mt-4 text-[13px] font-semibold text-[#7c8b86]">{label}</p>
            <p className="relative mt-1 text-[36px] font-black leading-none tracking-tight text-[#1e1b4b]">{value}</p>
          </Link>
        ))}
      </div>

      {/* Middle row */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={`${CARD} relative overflow-hidden lg:col-span-2`}>
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#6366f1] to-[#a5b4fc]" />
          <CardHead
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5"><path d="M3 17V9M9 17V4M15 17v-6M3 3v14h14" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            color="#6366f1"
            title="نشاط الصفقات"
            subtitle={`قيمة الصفقات · ${m.seriesRange}`}
            action={<span className="rounded-full border border-[#e4e4fb] bg-[#f5f5ff] px-3 py-1 text-xs font-semibold text-[#6366f1]">آخر ٧ أيام</span>}
          />
          <PipelineChart points={m.series} />
          <div className="mt-4 flex gap-8 border-t border-[#e8f0ec] pt-4">
            <div><p className="text-lg font-bold text-[#1e1b4b]">{m.total_deals}</p><p className="text-xs text-[#94a3b8]">إجمالي الصفقات</p></div>
            <div><p className="text-lg font-bold text-green-600">{m.won}</p><p className="text-xs text-[#94a3b8]">مكسوبة</p></div>
            <div><p className="text-lg font-bold text-red-600">{m.lost}</p><p className="text-xs text-[#94a3b8]">خاسرة</p></div>
          </div>
        </div>

        <div className={`${CARD} relative flex flex-col overflow-hidden`}>
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#1a5c4f] to-[#38d39f]" />
          <CardHead
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            color="#1a5c4f"
            title="اليوم"
            subtitle={longDate(now)}
            action={
              <p className="rounded-xl bg-[#f0faf8] px-3 py-1.5 text-lg font-black tabular-nums text-[#1a5c4f]">
                {now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
              </p>
            }
          />
          <div className="flex-1 border-t border-[#e8f0ec] pt-4">
            <p className="mb-3 text-xs font-semibold tracking-wider text-[#94a3b8]">المهام القادمة</p>
            {tasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#94a3b8]">🎉 لا مهام لليوم!</p>
            ) : (
              tasks.map((t) => {
                const done = completing.has(t.id);
                return (
                  <div key={t.id} className="flex items-center gap-3 border-b border-[#e8f0ec] py-2.5 last:border-0">
                    <button
                      type="button"
                      onClick={() => completeTask(t)}
                      aria-label="Mark task complete"
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        done ? "border-[#1a5c4f] bg-[#1a5c4f] text-white" : "border-gray-100 hover:border-[#1a5c4f]"
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
        {/* Sales Overview */}
        <div className={`${CARD} relative overflow-hidden`}>
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#f59e0b] to-[#fcd34d]" />
          <CardHead
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5"><path d="M10 2v8l6.5 3.8A8 8 0 1 1 10 2Z" strokeLinejoin="round" /></svg>}
            color="#f59e0b"
            title="ملخص المبيعات"
          />

          {/* Win-rate ring with won/lost split */}
          <div className="mb-5 flex items-center gap-5 border-b border-[#e8f0ec] pb-5">
            <div className="relative h-28 w-28 flex-none">
              <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#eef4f1" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none" stroke="#ef4444" strokeWidth="12" strokeLinecap="round" opacity="0.85"
                  strokeDasharray={`${m.total_deals ? (m.lost / m.total_deals) * 314.16 : 0} 314.16`}
                />
                <circle
                  cx="60" cy="60" r="50" fill="none" stroke="#1a5c4f" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${(Math.min(100, m.win_rate) / 100) * 314.16} 314.16`}
                  style={{ transition: "stroke-dasharray 0.6s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[22px] font-black leading-none text-[#1e1b4b]">{m.win_rate.toFixed(0)}%</span>
                <span className="mt-1 text-[9px] font-semibold text-[#94a3b8]">نسبة الفوز</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-[#f0faf8] px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1a5c4f]"><span className="h-2 w-2 rounded-full bg-[#1a5c4f]" />مكسوبة</span>
                <span className="text-sm font-black text-[#1a5c4f]">{m.won}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700"><span className="h-2 w-2 rounded-full bg-red-500" />خاسرة</span>
                <span className="text-sm font-black text-red-700">{m.lost}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            {overview.map((o) => (
              <div key={o.label} className="flex items-center justify-between rounded-xl px-2 py-2 transition-colors hover:bg-[#f8faf9]">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: o.dot }} />
                  <span className="text-sm text-[#334155]">{o.label}</span>
                </div>
                <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${o.badge}`}>{o.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className={`${CARD} relative overflow-hidden`}>
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#0ea5e9] to-[#7dd3fc]" />
          <CardHead
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5"><path d="M2 10h4l2-6 4 12 2-6h4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            color="#0ea5e9"
            title="آخر النشاطات"
            action={<Link href="/dashboard/activities" className="text-xs font-semibold text-[#0ea5e9] hover:underline">عرض الكل ←</Link>}
          />
          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#94a3b8]">لا توجد نشاطات مسجلة</p>
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
                  <p className="mb-1 inline-block rounded-full bg-[#f1f5f9] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#7c8b86]">{g.header}</p>
                  <div className="relative">
                    {g.items.length > 1 && <span className="absolute right-[13px] top-1 bottom-1 w-px bg-[#e8f0ec]" />}
                    {g.items.map((a) => {
                      const c = activityColor(a.activity_types?.label);
                      return (
                        <div key={a.id} className="relative flex gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-[#f8faf9]">
                          <span className="relative z-10 mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs ring-4 ring-white" style={{ backgroundColor: `${c}1a`, color: c }}>{activityGlyph(a.activity_types?.label)}</span>
                          <div className="min-w-0 flex-1">
                            <p dir="auto" className="line-clamp-2 text-sm leading-relaxed text-[#475569]">{a.body || a.activity_types?.label || "Activity"}</p>
                            <span className="text-xs text-[#94a3b8]">{formatDateTime(a.occurred_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()
          )}
        </div>

        {/* Recent Leads */}
        <div className={`${CARD} relative overflow-hidden`}>
          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[#ec4899] to-[#f9a8d4]" />
          <CardHead
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5"><circle cx="7" cy="7" r="3" /><circle cx="14" cy="9" r="2.4" /><path d="M2.5 17c.6-3 2.4-4.8 4.5-4.8s3.9 1.8 4.5 4.8M12.8 12.4c1.7.2 3 1.6 3.5 4" strokeLinecap="round" /></svg>}
            color="#ec4899"
            title="أحدث العملاء"
            action={<Link href="/dashboard/leads" className="text-xs font-semibold text-[#ec4899] hover:underline">عرض الكل ←</Link>}
          />
          {m.recentLeads.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-[#94a3b8]">لا يوجد عملاء بعد — أضف أول عميل</p>
              <button onClick={() => setNewLeadOpen(true)} className="mt-3 rounded-full bg-[#1a5c4f] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#15503f]">+ عميل جديد</button>
            </div>
          ) : (
            m.recentLeads.map((l, i) => {
              const score = getAIScore(l, scoreModel);
              return (
                <Link key={l.id} href={`/dashboard/leads?open=${l.id}`} className="flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-[#f8faf9]">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-sm ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]}`}>
                    <span className="text-xs font-bold text-white">{initials(l.full_name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-sm font-semibold text-[#1e1b4b]">{l.full_name || "عميل بدون اسم"}</p>
                    <p className="text-xs text-[#94a3b8]">{l.sources?.label || "—"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${aiPill(score)}`}>{score}%</span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      <NewLeadSlideOver open={newLeadOpen} onClose={() => setNewLeadOpen(false)} onCreated={load} />
      <LogActivitySlideOver open={logActivityOpen} onClose={() => setLogActivityOpen(false)} onCreated={load} />
      <AddContactSlideOver open={addContactOpen} onClose={() => setAddContactOpen(false)} onCreated={load} />
    </div>
  );
}
