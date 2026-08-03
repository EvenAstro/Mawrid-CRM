"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon, LeadsIcon } from "@/components/navIcons";
import LeadSlideOver, { type Lead } from "@/components/LeadSlideOver";
import NewLeadSlideOver from "@/components/NewLeadSlideOver";
import { fetchLeadScoreModel, getAIScore, type LeadScoreModel } from "@/lib/leadScore/computeLeadScore";
import { useRole } from "@/components/RoleProvider";
import { canViewAllData } from "@/lib/permissions";
import { initials, formatDate } from "@/lib/format";

const PAGE_SIZE = 15;

function scoreHex(score: number): string {
  if (score >= 70) return "#10b981"; // green
  if (score >= 40) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

/** Compact colored progress ring with the score in matching color. */
function AiScoreRing({ score }: { score: number }) {
  const color = scoreHex(score);
  const R = 15;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex h-9 w-9 items-center justify-center">
        <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
          <circle cx="18" cy="18" r={R} fill="none" stroke="#e8efed" strokeWidth="3.5" />
          <circle
            cx="18"
            cy="18"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
          />
        </svg>
      </span>
      <span className="text-[13px] font-bold" style={{ color }}>{score}%</span>
    </span>
  );
}


function StatCard({
  value,
  label,
  color,
  icon,
  active,
  onClick,
}: {
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-5 text-left shadow-[0_2px_8px_rgba(26,92,79,0.05)] transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: active ? color : "#e4ebe7",
        background: active ? `linear-gradient(155deg, ${color}14 0%, #fff 55%)` : "#fff",
        boxShadow: active ? `0 10px 28px ${color}22` : undefined,
      }}
    >
      <span className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full opacity-[0.08] transition-transform duration-300 group-hover:scale-125" style={{ background: color }} />
      <span className="relative flex h-12 w-12 flex-none items-center justify-center rounded-xl shadow-sm" style={{ backgroundColor: color, color: "#fff" }}>
        {icon}
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="text-[26px] font-bold leading-none text-[#1e1b4b] tabular-nums">{value}</p>
        <p className="mt-1 text-[13px] font-medium text-[#7c8b86]">{label}</p>
      </div>
      {active && <span className="absolute top-3 left-3 h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
    </button>
  );
}

export default function LeadsPage() {
  const { role, userId, loading: roleLoading } = useRole();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [error, setError] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "clean" | "junk">("all");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [scoreModel, setScoreModel] = useState<LeadScoreModel | null>(null);

  // Honor ?filter= and ?open= params from dashboard deep-links.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const f = p.get("filter");
    if (f === "clean" || f === "junk") setStatusFilter(f);
    const o = p.get("open");
    if (o) setOpenLeadId(o);
  }, []);

  async function load() {
    setError(false);
    // Alias normalized_phone/normalized_email to the phone/email the UI expects.
    let query = supabase
      .from("leads")
      .select(
        `*, phone:normalized_phone, email:normalized_email, pipeline_stages(label, color), sources(label), junk_reasons(label)`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Sales reps only see leads assigned to them; managers/admins see all.
    if (!canViewAllData(role) && userId) {
      query = query.eq("owner_id", userId);
    }

    const { data, error: err } = await query;

    if (err) {
      console.error("[Leads] Supabase fetch failed", err);
      setError(true);
    } else if (data) {
      setLeads(data as unknown as Lead[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (roleLoading) return; // wait for the current user's role to resolve first
    load();
  }, [roleLoading, role, userId]);

  useEffect(() => {
    fetchLeadScoreModel()
      .then(setScoreModel)
      .catch((err) => console.error("[Leads] lead score model failed", err));
  }, []);

  // Cache AI scores per lead id so they aren't recomputed on every render.
  const scoreCache = useMemo(() => {
    const map = new Map<string | number, number>();
    for (const l of leads) map.set(l.id, getAIScore(l, scoreModel));
    return map;
  }, [leads, scoreModel]);

  // Open the deep-linked lead once data has loaded.
  useEffect(() => {
    if (!openLeadId || !leads.length) return;
    const match = leads.find((l) => String(l.id) === openLeadId);
    if (match) {
      setSelectedLead(match);
      setOpenLeadId(null);
    }
  }, [openLeadId, leads]);

  // Filter option lists
  const stageOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.pipeline_stages?.label && set.add(l.pipeline_stages.label));
    return Array.from(set).sort();
  }, [leads]);

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => l.sources?.label && set.add(l.sources.label));
    return Array.from(set).sort();
  }, [leads]);

  // Apply filters + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter === "clean" && l.junk_reason_id != null) return false;
      if (statusFilter === "junk" && l.junk_reason_id == null) return false;
      if (stageFilter !== "all" && l.pipeline_stages?.label !== stageFilter)
        return false;
      if (sourceFilter !== "all" && l.sources?.label !== sourceFilter)
        return false;
      if (!q) return true;
      return (
        (l.full_name ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, stageFilter, sourceFilter, statusFilter]);

  const cleanCount = leads.filter((l) => l.junk_reason_id == null).length;
  const junkCount = leads.length - cleanCount;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, stageFilter, sourceFilter, statusFilter]);

  return (
    <>
      {/* Hero header */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#141c2e] via-[#1a2440] to-[#241a44] px-7 py-7 shadow-[0_16px_40px_rgba(20,28,46,0.25)]">
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#818cf8] opacity-[0.12] blur-[70px]" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-[#38d39f] opacity-[0.08] blur-[60px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
              <LeadsIcon className="h-6 w-6 text-[#a5b4fc]" />
            </div>
            <div>
              <h1 dir="auto" className="text-[26px] font-bold tracking-[-0.02em] text-white">العملاء المحتملون</h1>
              <p className="mt-1 text-sm text-white/50">إدارة ومتابعة مسار العملاء المحتملين</p>
            </div>
          </div>
          <button
            onClick={() => setNewLeadOpen(true)}
            className="flex h-11 items-center gap-2 rounded-xl bg-[#38d39f] px-5 text-[14px] font-bold text-[#0f3a30] shadow-[0_4px_16px_rgba(56,211,159,0.3)] transition-all hover:-translate-y-px hover:bg-[#4fdcae] active:scale-[0.98]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
            إضافة عميل
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          value={leads.length}
          label="إجمالي العملاء"
          color="#6366f1"
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" /></svg>}
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <StatCard
          value={cleanCount}
          label="عملاء مؤهلون"
          color="#10b981"
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>}
          active={statusFilter === "clean"}
          onClick={() => setStatusFilter("clean")}
        />
        <StatCard
          value={junkCount}
          label="غير مؤهلين"
          color="#f43f5e"
          icon={<svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" /></svg>}
          active={statusFilter === "junk"}
          onClick={() => setStatusFilter("junk")}
        />
      </div>

      {/* Search & filter bar */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#e4e4fb] bg-white p-4 shadow-[0_2px_8px_rgba(26,92,79,0.05)] sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، الجوال، أو الإيميل…"
            className="h-11 w-full rounded-xl border border-[#e4e4fb] bg-[#f8f8ff] pl-11 pr-4 text-[14px] text-slate-700 placeholder:text-slate-400 focus:border-[#6366f1] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/15 transition"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-11 rounded-xl border border-[#e4e4fb] bg-[#f8f8ff] px-4 text-[14px] font-medium text-slate-700 focus:border-[#6366f1] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/15 transition"
        >
          <option value="all">جميع المراحل</option>
          {stageOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-11 rounded-xl border border-[#e4e4fb] bg-[#f8f8ff] px-4 text-[14px] font-medium text-slate-700 focus:border-[#6366f1] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366f1]/15 transition"
        >
          <option value="all">جميع المصادر</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[#e4e4fb] bg-white shadow-[0_2px_8px_rgba(26,92,79,0.05)]">
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#eeeefd] bg-[#f8f8ff] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-3 py-3.5">العميل</th>
                <th className="px-3 py-3.5">المصدر</th>
                <th className="px-3 py-3.5">المرحلة</th>
                <th className="px-3 py-3.5">الحالة</th>
                <th className="px-3 py-3.5">تقييم AI</th>
                <th className="px-3 py-3.5">المسؤول</th>
                <th className="px-3 py-3.5">التاريخ</th>
                <th className="px-3 py-3.5 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="inline-flex items-center gap-3 text-[14px] text-slate-500">
                      <svg className="h-4 w-4 animate-spin text-emerald-600" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>
                      جارِ تحميل العملاء…
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">🔌</div>
                      <p className="text-[15px] font-semibold text-slate-700">تعذّر الاتصال</p>
                      <p className="text-[13px] text-slate-400">لم نستطع تحميل بيانات العملاء</p>
                      <button
                        onClick={() => { setLoading(true); load(); }}
                        className="mt-1 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-700"
                      >
                        إعادة المحاولة
                      </button>
                    </div>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <LeadsIcon />
                      </div>
                      <p className="text-[15px] font-semibold text-slate-700">
                        لا توجد عملاء
                      </p>
                      <p className="mt-1 text-[13px] text-slate-400">
                        جرّب تعديل البحث أو الفلاتر
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((lead) => {
                  const isJunk = lead.junk_reason_id != null;
                  const stageColor = lead.pipeline_stages?.color || "#059669";
                  const outcome = lead.contact_outcome;
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`group cursor-pointer border-b border-[#f1f1fc] transition-all duration-100 last:border-0 hover:bg-[#f8f8ff] ${isJunk ? "opacity-60" : ""}`}
                    >
                      {/* Name */}
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#4338ca] text-[13px] font-bold text-white shadow-sm">
                            {initials(lead.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p dir="auto" className="truncate text-[14px] font-semibold text-slate-900">
                              {lead.full_name || "Unnamed lead"}
                            </p>
                            <p className="truncate text-[12px] text-slate-400">
                              {lead.phone || lead.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-3 py-4">
                        {lead.sources?.label ? (
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
                            {lead.sources.label}
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-300">—</span>
                        )}
                      </td>

                      {/* Stage */}
                      <td className="px-3 py-4">
                        {lead.pipeline_stages?.label ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                            style={{
                              backgroundColor: `${stageColor}15`,
                              color: stageColor,
                            }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor }} />
                            {lead.pipeline_stages.label}
                          </span>
                        ) : (
                          <span className="text-[13px] text-slate-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-4">
                        {isJunk ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-[12px] font-semibold text-red-600 ring-1 ring-red-100">
                            🚫 جنك
                          </span>
                        ) : outcome === "responded" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-600 ring-1 ring-emerald-100">
                            ✅ رد
                          </span>
                        ) : outcome === "no_response" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-600 ring-1 ring-amber-100">
                            ⏳ لم يرد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-500 ring-1 ring-slate-100">
                            جديد
                          </span>
                        )}
                      </td>

                      {/* AI Score */}
                      <td className="px-3 py-4">
                        <AiScoreRing score={scoreCache.get(lead.id) ?? getAIScore(lead, scoreModel)} />
                      </td>

                      {/* Owner */}
                      <td className="px-3 py-4 text-[13px] font-medium text-slate-600">
                        {lead.owner || <span className="text-slate-300">—</span>}
                      </td>

                      {/* Created */}
                      <td className="px-3 py-4 text-[12px] text-slate-400">
                        {formatDate(lead.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-4 text-right">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-500 opacity-0 transition group-hover:bg-[#6366f1] group-hover:text-white group-hover:opacity-100">
                          فتح ←
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-[#f1f1fc] bg-[#f8f8ff] px-6 py-3.5">
            <p className="text-[13px] text-slate-500">
              عرض{" "}
              <span className="font-bold text-slate-700 tabular-nums">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </span>{" "}
              من{" "}
              <span className="font-bold text-slate-700 tabular-nums">
                {filtered.length}
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e4e4fb] bg-white text-slate-500 transition hover:border-[#6366f1] hover:text-[#6366f1] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#e4e4fb] disabled:hover:text-slate-500"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06L11.19 8 7.72 4.53a.75.75 0 011.06-1.06l4 4a.75.75 0 010 1.06l-4 4a.75.75 0 01-1.06 0z" clipRule="evenodd" /></svg>
              </button>
              <span className="min-w-[80px] text-center text-[13px] font-semibold text-slate-600 tabular-nums">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e4e4fb] bg-white text-slate-500 transition hover:border-[#6366f1] hover:text-[#6366f1] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#e4e4fb] disabled:hover:text-slate-500"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M12.28 7.47a.75.75 0 010 1.06L8.81 12l3.47 3.47a.75.75 0 11-1.06 1.06l-4-4a.75.75 0 010-1.06l4-4a.75.75 0 011.06 0z" clipRule="evenodd" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over detail panel */}
      <LeadSlideOver lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdated={load} />
      <NewLeadSlideOver open={newLeadOpen} onClose={() => setNewLeadOpen(false)} onCreated={load} />
    </>
  );
}
