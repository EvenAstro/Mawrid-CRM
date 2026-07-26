"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon, LeadsIcon } from "@/components/navIcons";
import LeadSlideOver, { type Lead } from "@/components/LeadSlideOver";
import NewLeadSlideOver from "@/components/NewLeadSlideOver";
import { fetchLeadScoreModel, scoreWithModel, type LeadScoreModel } from "@/lib/leadScore/computeLeadScore";

const PAGE_SIZE = 15;

function initials(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}

function getAIScore(lead: Lead, model: LeadScoreModel | null): number {
  if (!model) return 50;
  return scoreWithModel(model, {
    source: lead.sources?.label || "غير محدد",
    matched: !!lead.establishment_id,
    hasCampaign: false,
  }).score;
}

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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatCard({
  value,
  label,
  tint,
  emoji,
  active,
  onClick,
}: {
  value: number;
  label: string;
  tint: string;
  emoji: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-full border bg-white px-4 py-3 text-left shadow-sm transition-all hover:border-[#1a5c4f] ${active ? "border-[#1a5c4f] ring-2 ring-[#1a5c4f]/15" : "border-gray-100"}`}
    >
      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-base ${tint}`}>
        {emoji}
      </span>
      <div>
        <p className="text-lg font-extrabold leading-none text-[#1e1b4b]">{value}</p>
        <p className="mt-0.5 text-[13px] text-[#94a3b8]">{label}</p>
      </div>
    </button>
  );
}

export default function LeadsPage() {
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
    const { data, error: err } = await supabase
      .from("leads")
      .select(
        `*, phone:normalized_phone, email:normalized_email, pipeline_stages(label, color), sources(label), junk_reasons(label)`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (err) {
      console.error("[Leads] Supabase fetch failed", err);
      setError(true);
    } else if (data) {
      setLeads(data as unknown as Lead[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
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
      {/* Header */}
      <div className="mb-6">
        <h1 dir="auto" className="text-2xl font-extrabold text-[#1e1b4b]">العملاء المحتملون</h1>
        <p className="mt-1 text-[15px] text-[#94a3b8]">
          إدارة ومتابعة مسار العملاء المحتملين
        </p>
      </div>

      {/* Stats bar */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard value={leads.length} label="إجمالي العملاء" emoji="🎯" tint="bg-[#f0faf8]" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
        <StatCard value={cleanCount} label="عملاء مؤهلون" emoji="✅" tint="bg-emerald-50" active={statusFilter === "clean"} onClick={() => setStatusFilter("clean")} />
        <StatCard value={junkCount} label="غير مؤهلين" emoji="🗑️" tint="bg-red-50" active={statusFilter === "junk"} onClick={() => setStatusFilter("junk")} />
      </div>

      {/* Search & filter bar */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or email…"
            className="h-11 w-full rounded-xl border border-gray-100 bg-white pl-10 pr-4 text-[15px] text-[#334155] placeholder:text-[#94a3b8]"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-11 rounded-xl border border-gray-100 bg-white px-3 text-[15px] text-[#334155] focus:border-[#1a5c4f] focus:outline-none"
        >
          <option value="all">All Stages</option>
          {stageOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-11 rounded-xl border border-gray-100 bg-white px-3 text-[15px] text-[#334155] focus:border-[#1a5c4f] focus:outline-none"
        >
          <option value="all">All Sources</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          onClick={() => setNewLeadOpen(true)}
          className="h-11 flex-none rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] px-6 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(26,92,79,0.2)] transition-all hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(26,92,79,0.28)]"
        >
          + Add Lead
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-25 text-[12px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">AI Score</th>
                <th className="px-6 py-3">Owner</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-[15px] text-[#94a3b8]">
                    Loading leads…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl">🔌</div>
                      <p className="text-[15px] font-semibold text-[#334155]">Connection error</p>
                      <p className="text-[13px] text-[#94a3b8]">We couldn&apos;t load your leads.</p>
                      <button
                        onClick={() => { setLoading(true); load(); }}
                        className="mt-1 rounded-lg bg-[#1a5c4f] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#15503f]"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0faf8] text-[#1a5c4f]">
                        <LeadsIcon />
                      </div>
                      <p className="text-[15px] font-semibold text-[#94a3b8]">
                        No leads found
                      </p>
                      <p className="mt-1 text-[13px] text-[#94a3b8]">
                        Try adjusting your search or filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((lead) => {
                  const isJunk = lead.junk_reason_id != null;
                  const stageColor = lead.pipeline_stages?.color || "#1a5c4f";
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className={`cursor-pointer border-b border-gray-50 transition-colors duration-100 last:border-0 hover:bg-teal-50 ${isJunk ? "opacity-50 grayscale-[20%]" : ""}`}
                    >
                      {/* Name */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#1a5c4f] text-[13px] font-bold text-white">
                            {initials(lead.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p dir="auto" className="truncate text-[15px] font-semibold text-[#1e1b4b]">
                              {lead.full_name || "Unnamed lead"}
                            </p>
                            <p className="truncate text-[13px] text-[#94a3b8]">
                              {lead.phone || lead.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-6 py-3.5">
                        {lead.sources?.label ? (
                          <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-700">
                            {lead.sources.label}
                          </span>
                        ) : (
                          <span className="text-[13px] text-[#d1d5db]">—</span>
                        )}
                      </td>

                      {/* Stage */}
                      <td className="px-6 py-3.5">
                        {lead.pipeline_stages?.label ? (
                          <span
                            className="rounded-full px-2 py-1 text-[13px] font-medium"
                            style={{
                              backgroundColor: `${stageColor}1a`,
                              color: stageColor,
                            }}
                          >
                            {lead.pipeline_stages.label}
                          </span>
                        ) : (
                          <span className="text-[13px] text-[#d1d5db]">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3.5">
                        {isJunk ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-[13px] font-medium text-red-700">
                            Junk
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-medium text-emerald-700">
                            Active
                          </span>
                        )}
                      </td>

                      {/* AI Score */}
                      <td className="px-6 py-3.5">
                        <AiScoreRing score={scoreCache.get(lead.id) ?? getAIScore(lead, scoreModel)} />
                      </td>

                      {/* Owner */}
                      <td className="px-6 py-3.5 text-[15px] text-[#334155]">
                        {lead.owner || "—"}
                      </td>

                      {/* Created */}
                      <td className="px-6 py-3.5 text-[13px] text-[#94a3b8]">
                        {formatDate(lead.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="rounded-lg border border-[#1a5c4f] px-3 py-1.5 text-[13px] font-semibold text-[#1a5c4f] transition hover:bg-[#1a5c4f] hover:text-white"
                        >
                          View
                        </button>
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
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
            <p className="text-[13px] text-[#94a3b8]">
              Showing{" "}
              <span className="font-semibold text-[#334155]">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#334155]">
                {filtered.length}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-100 px-3 py-1.5 text-[13px] font-semibold text-[#334155] transition hover:bg-gray-25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[13px] font-medium text-[#94a3b8]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-100 px-3 py-1.5 text-[13px] font-semibold text-[#334155] transition hover:bg-gray-25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
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
