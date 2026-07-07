"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

/* ---------- Types ---------- */
type Stage = { label: string; terminal_type: string | null } | null;

interface Lead {
  id: number | string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  junk_reason_id: number | null;
  sources: { label: string } | null;
  pipeline_stages: Stage;
  junk_reasons: { label: string } | null;
}
interface Deal {
  id: number | string;
  expected_value_minor: number | null;
  created_at: string | null;
  pipeline_stages: Stage;
}
interface Activity {
  id: number | string;
  body: string | null;
  occurred_at: string | null;
  direction: string | null;
  activity_types: { label: string; color?: string | null } | null;
}
interface Contact {
  id: number | string;
  full_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string | null;
  department?: string | null;
  created_at?: string | null;
}
interface Task {
  id: number | string;
  title?: string | null;
  name?: string | null;
  due_at: string | null;
}

/* ---------- Date helpers ---------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function longDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
function isToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}
function shortDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function dateTimeNice(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} at ${time}`;
}
function timeOf(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}
function last7Days(): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
}
function sameDay(iso: string | null | undefined, day: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

/* ---------- Misc helpers ---------- */
function initials(name: string | null | undefined) {
  if (!name) return "—";
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
}
function contactName(c: Contact) {
  return (
    c.full_name ||
    c.name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    "Unnamed"
  );
}
function taskTitle(t: Task) {
  return t.title || t.name || "Untitled task";
}
const nf = new Intl.NumberFormat("en-US");
const money = (n: number) => nf.format(Math.round(n));

const SOURCE_PALETTE = [
  "#1a5c4f",
  "#1e1b4b",
  "#b45309",
  "#059669",
  "#0369a1",
  "#be123c",
  "#0e7490",
];
function sourceColor(label: string) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return SOURCE_PALETTE[h % SOURCE_PALETTE.length];
}

const OPEN_TICKETS = 11; // no tickets query provided in spec

/* ---------- Sparkline ---------- */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 100;
  const h = 28;
  const pad = 2;
  const max = Math.max(1, ...data);
  const step = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data
    .map((v, i) => `${pad + i * step},${h - pad - (v / max) * (h - pad * 2)}`)
    .join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-2">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- Deal trend chart ---------- */
function DealTrendChart({
  points,
}: {
  points: { label: string; value: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 200;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 30;
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
  const area =
    coords.length > 0
      ? `${line} L ${coords[coords.length - 1].x} ${H - padB} L ${coords[0].x} ${H - padB} Z`
      : "";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-56 w-full"
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="dealArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a5c4f" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#1a5c4f" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((g) => (
        <line
          key={g}
          x1={padL}
          x2={W - padR}
          y1={y(maxVal * g)}
          y2={y(maxVal * g)}
          stroke="#f1f5f9"
          strokeWidth="1"
        />
      ))}

      {area && <path d={area} fill="url(#dealArea)" />}
      {line && (
        <path d={line} fill="none" stroke="#1a5c4f" strokeWidth="3" strokeLinecap="round" />
      )}

      {points.map((p, i) => (
        <g key={p.label}>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {p.label}
          </text>
          <circle cx={x(i)} cy={y(p.value)} r="5" fill="white" stroke="#1a5c4f" strokeWidth="3" />
          <circle
            cx={x(i)}
            cy={y(p.value)}
            r="16"
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        </g>
      ))}

      {hover != null && (
        <g>
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padT}
            y2={H - padB}
            stroke="#1a5c4f"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <rect
            x={Math.min(Math.max(x(hover) - 45, 2), W - 92)}
            y={Math.max(y(points[hover].value) - 42, 2)}
            width="90"
            height="34"
            rx="6"
            fill="#1e1b4b"
          />
          <text
            x={Math.min(Math.max(x(hover), 47), W - 47)}
            y={Math.max(y(points[hover].value) - 27, 17)}
            textAnchor="middle"
            fontSize="9"
            fill="#a5b4c9"
          >
            {points[hover].label}
          </text>
          <text
            x={Math.min(Math.max(x(hover), 47), W - 47)}
            y={Math.max(y(points[hover].value) - 15, 29)}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fill="white"
          >
            SAR {money(points[hover].value)}
          </text>
        </g>
      )}
    </svg>
  );
}

/* ---------- Page ---------- */
export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function load() {
      const [l, d, a, c, t] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "*, sources(label), pipeline_stages(label, terminal_type), junk_reasons(label)",
          )
          .is("deleted_at", null),
        supabase
          .from("deals")
          .select("*, pipeline_stages(label, terminal_type)")
          .is("deleted_at", null),
        supabase
          .from("activities")
          .select("*, activity_types(label)")
          .order("occurred_at", { ascending: false })
          .limit(10),
        supabase
          .from("contacts")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("tasks")
          .select("*")
          .is("completed_at", null)
          .order("due_at", { ascending: true })
          .limit(5),
      ]);
      if (l.data) setLeads(l.data as unknown as Lead[]);
      if (d.data) setDeals(d.data as unknown as Deal[]);
      if (a.data) setActivities(a.data as unknown as Activity[]);
      if (c.data) setContacts(c.data as unknown as Contact[]);
      if (t.data) setTasks(t.data as unknown as Task[]);
    }
    load();
  }, []);

  const m = useMemo(() => {
    const total_leads = leads.length;
    const clean_leads = leads.filter((l) => !l.junk_reason_id).length;
    const junk_leads = total_leads - clean_leads;
    const total_deals = deals.length;
    const total_activities = activities.length;
    const pipeline_value =
      deals.reduce((s, d) => s + (d.expected_value_minor || 0), 0) / 100;
    const won_deals = deals.filter(
      (d) => d.pipeline_stages?.terminal_type === "won",
    ).length;
    const today_tasks = tasks.filter((t) => isToday(t.due_at)).length;

    // 7-day deal value series (fixed grouping)
    const days = last7Days();
    const series = days.map((day) => ({
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      value:
        deals
          .filter((d) => sameDay(d.created_at, day))
          .reduce((s, d) => s + (d.expected_value_minor || 0), 0) / 100,
    }));

    // Sparkline daily counts
    const sparkLeads = days.map(
      (day) => leads.filter((l) => sameDay(l.created_at, day)).length,
    );
    const sparkDeals = days.map(
      (day) => deals.filter((d) => sameDay(d.created_at, day)).length,
    );
    const sparkActs = days.map(
      (day) => activities.filter((a) => sameDay(a.occurred_at, day)).length,
    );
    const sparkContacts = days.map(
      (day) => contacts.filter((c) => sameDay(c.created_at, day)).length,
    );

    return {
      total_leads,
      clean_leads,
      junk_leads,
      total_deals,
      total_activities,
      pipeline_value,
      won_deals,
      today_tasks,
      series,
      sparkLeads,
      sparkDeals,
      sparkActs,
      sparkContacts,
    };
  }, [leads, deals, activities, contacts, tasks]);

  const kpis = [
    {
      label: "Contacts",
      value: contacts.length,
      color: "#1a5c4f",
      spark: m.sparkContacts,
    },
    { label: "Leads", value: m.total_leads, color: "#1e1b4b", spark: m.sparkLeads },
    { label: "Deals", value: m.total_deals, color: "#f59e0b", spark: m.sparkDeals },
    {
      label: "Activities",
      value: m.total_activities,
      color: "#059669",
      spark: m.sparkActs,
    },
  ];

  return (
    <>
      {/* ROW 1 — Welcome + companion */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Welcome */}
        <div className="relative min-h-[200px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e1b4b] to-[#1a5c4f] p-8 text-white shadow-[0_0_45px_-10px_rgba(26,92,79,0.55)] lg:col-span-2">
          {/* dot pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          {/* teal glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#4fd1b5]/20 blur-3xl" />

          <div className="relative">
            <h2 className="text-4xl font-extrabold">{greeting()} 👋</h2>
            <p className="mt-1 text-white/60">{longDate(now)}</p>
            <p className="mt-5 text-lg font-semibold">Revenue Cockpit</p>
            <p className="text-sm text-white/50">
              Your team&apos;s pipeline at a glance
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/leads"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#1a5c4f] transition hover:bg-[#f0faf8]"
              >
                + New Lead
              </Link>
              <button className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
                Log Activity
              </button>
              <button className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
                Add Contact
              </button>
            </div>
          </div>
        </div>

        {/* Companion — live clock + snapshot (no task list) */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e6f7f3] bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#1e1b4b]">Today</h3>
            <span className="text-lg">🕐</span>
          </div>
          <p className="text-3xl font-extrabold tabular-nums text-[#1a5c4f]">
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
          <p className="text-xs text-gray-400">{longDate(now)}</p>
          <div className="mt-auto flex flex-col gap-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Pipeline</span>
              <span className="rounded-full bg-[#f0faf8] px-3 py-1 text-xs font-semibold text-[#1a5c4f]">
                SAR {money(m.pipeline_value)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Tasks due today</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
                {m.today_tasks}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2 — KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-[#e6f7f3] bg-white p-5 shadow-sm transition-all hover:shadow-md"
            style={{ borderLeft: `4px solid ${k.color}` }}
          >
            <p className="text-xs uppercase tracking-wide text-gray-400">
              {k.label}
            </p>
            <p className="mt-1 text-4xl font-extrabold text-[#1e1b4b]">
              {k.value}
            </p>
            <Sparkline data={k.spark} color={k.color} />
          </div>
        ))}
      </div>

      {/* ROW 3 — Chart + Tasks */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#e6f7f3] bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-bold text-[#1e1b4b]">Deal Value Trend</h3>
              <p className="text-sm text-gray-400">
                Latest deals from your database
              </p>
            </div>
            <span className="rounded-full bg-[#f0faf8] px-3 py-1 text-xs font-semibold text-[#1a5c4f]">
              Pipeline SAR {money(m.pipeline_value)}
            </span>
          </div>
          <DealTrendChart points={m.series} />
        </div>

        <div className="rounded-2xl border border-[#e6f7f3] bg-white p-6">
          <div className="mb-1 flex items-start justify-between">
            <h3 className="font-bold text-[#1e1b4b]">Today&apos;s Tasks</h3>
            <Link
              href="/dashboard/tasks"
              className="text-sm font-semibold text-[#1a5c4f] hover:underline"
            >
              Tasks →
            </Link>
          </div>
          <p className="mb-4 text-sm text-gray-400">Tasks ordered by due date</p>
          {tasks.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              No follow-up tasks available.
            </p>
          ) : (
            <div className="flex flex-col">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0"
                >
                  <span className="h-[18px] w-[18px] flex-none rounded-full border-2 border-gray-200" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1e1b4b]">
                      {taskTitle(t)}
                    </p>
                  </div>
                  <span className="flex-none text-xs text-gray-400">
                    {timeOf(t.due_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 4 — Recent Contacts + Activity Timeline */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e6f7f3] bg-white p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-bold text-[#1e1b4b]">Recent Contacts</h3>
              <p className="text-sm text-gray-400">
                Newest relationships added to CRM
              </p>
            </div>
            <Link
              href="/dashboard/contacts"
              className="text-sm font-semibold text-[#1a5c4f] hover:underline"
            >
              All →
            </Link>
          </div>
          {contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No contacts yet.
            </p>
          ) : (
            <div className="flex flex-col">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0"
                >
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#1a5c4f] text-xs font-bold text-white">
                    {initials(contactName(c))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#1e1b4b]">
                      {contactName(c)}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {c.phone || c.role || "—"}
                    </p>
                  </div>
                  <span className="flex-none text-xs text-gray-400">
                    {c.role || c.department || ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#e6f7f3] bg-white p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-bold text-[#1e1b4b]">Activity Timeline</h3>
              <p className="text-sm text-gray-400">Latest touchpoints</p>
            </div>
            <Link
              href="/dashboard/activities"
              className="text-sm font-semibold text-[#1a5c4f] hover:underline"
            >
              All →
            </Link>
          </div>
          {activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No activity recorded.
            </p>
          ) : (
            <div className="flex flex-col">
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-3 border-b border-gray-50 py-3 last:border-0"
                >
                  <span
                    className="mt-1.5 h-2 w-2 flex-none rounded-full"
                    style={{ backgroundColor: a.activity_types?.color || "#1a5c4f" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#1e1b4b]">
                      {(a.body || a.activity_types?.label || "Activity").slice(0, 60)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {dateTimeNice(a.occurred_at)}
                    </p>
                  </div>
                  {a.direction && (
                    <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      {a.direction}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 5 — Latest Leads + Sales Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e6f7f3] bg-white p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-bold text-[#1e1b4b]">Latest Leads</h3>
              <p className="text-sm text-gray-400">
                Fresh opportunities entering pipeline
              </p>
            </div>
            <Link
              href="/dashboard/leads"
              className="text-sm font-semibold text-[#1a5c4f] hover:underline"
            >
              All →
            </Link>
          </div>
          {leads.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No leads yet.
            </p>
          ) : (
            <div className="flex flex-col">
              {[...leads]
                .sort(
                  (a, b) =>
                    new Date(b.created_at ?? 0).getTime() -
                    new Date(a.created_at ?? 0).getTime(),
                )
                .slice(0, 5)
                .map((l) => {
                  const src = l.sources?.label;
                  const col = src ? sourceColor(src) : "#94a3b8";
                  return (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0"
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#1a5c4f] text-xs font-bold text-white">
                        {initials(l.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1e1b4b]">
                          {l.full_name || "Unnamed lead"}
                        </p>
                        <p className="truncate text-xs text-gray-400">
                          {l.email || l.phone || "—"}
                        </p>
                      </div>
                      {src && (
                        <span
                          className="flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: `${col}1a`, color: col }}
                        >
                          {src}
                        </span>
                      )}
                      <span className="flex-none text-xs text-gray-400">
                        {shortDate(l.created_at)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#e6f7f3] bg-white p-6">
          <div className="mb-2">
            <h3 className="font-bold text-[#1e1b4b]">Sales Summary</h3>
            <p className="text-sm text-gray-400">
              Database-backed performance snapshot
            </p>
          </div>
          <div className="flex flex-col">
            <SummaryRow
              label="Total Pipeline Value"
              value={`SAR ${money(m.pipeline_value)}`}
              tone="teal"
            />
            <SummaryRow label="Open Activities" value={m.total_activities} tone="gray" />
            <SummaryRow label="Won Deals" value={m.won_deals} tone="green" />
            <SummaryRow label="Open Tickets" value={OPEN_TICKETS} tone="gray" />
            <SummaryRow label="Clean Leads" value={m.clean_leads} tone="green" />
            <SummaryRow label="Junk Leads" value={m.junk_leads} tone="red" />
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "teal" | "gray" | "green" | "red";
}) {
  const tones: Record<string, string> = {
    teal: "bg-[#f0faf8] text-[#1a5c4f]",
    gray: "bg-gray-100 text-gray-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="flex items-center justify-between border-b border-gray-50 py-3 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
        {value}
      </span>
    </div>
  );
}
