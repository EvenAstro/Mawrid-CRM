"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon, LeadsIcon } from "@/components/navIcons";
import LeadSlideOver, { type Lead } from "@/components/LeadSlideOver";

const PAGE_SIZE = 20;

function initials(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
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
}: {
  value: number;
  label: string;
  tint: string;
  emoji: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e6f7f3] bg-white px-4 py-3 shadow-sm">
      <span
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg text-base ${tint}`}
      >
        {emoji}
      </span>
      <div>
        <p className="text-lg font-extrabold leading-none text-[#1e1b4b]">
          {value}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">{label}</p>
      </div>
    </div>
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

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("leads")
        .select(
          `*, pipeline_stages(label, color), sources(label), junk_reasons(label)`,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setLeads(data as unknown as Lead[]);
      }
      setLoading(false);
    }
    load();
  }, []);

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
  }, [leads, search, stageFilter, sourceFilter]);

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
  }, [search, stageFilter, sourceFilter]);

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-[#1e1b4b]">Leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage and track your leads pipeline
        </p>
      </div>

      {/* Stats bar */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          value={leads.length}
          label="Total Leads"
          emoji="🎯"
          tint="bg-[#f0faf8]"
        />
        <StatCard
          value={cleanCount}
          label="Clean Leads"
          emoji="✅"
          tint="bg-emerald-50"
        />
        <StatCard
          value={junkCount}
          label="Junk Leads"
          emoji="🗑️"
          tint="bg-red-50"
        />
      </div>

      {/* Search & filter bar */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#e6f7f3] bg-white p-4 shadow-sm sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or email…"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#1a5c4f] focus:outline-none"
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
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#1a5c4f] focus:outline-none"
        >
          <option value="all">All Sources</option>
          {sourceOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button className="h-11 flex-none rounded-xl bg-[#1a5c4f] px-4 text-sm font-semibold text-white shadow-sm shadow-[#1a5c4f]/25 hover:bg-[#15503f]">
          + Add Lead
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Stage</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Owner</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-gray-400">
                    Loading leads…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0faf8] text-[#1a5c4f]">
                        <LeadsIcon />
                      </div>
                      <p className="text-sm font-semibold text-gray-500">
                        No leads found
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
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
                      className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50"
                    >
                      {/* Name */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#1a5c4f] text-xs font-bold text-white">
                            {initials(lead.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#1e1b4b]">
                              {lead.full_name || "Unnamed lead"}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {lead.phone || lead.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-6 py-3.5">
                        {lead.sources?.label ? (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {lead.sources.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Stage */}
                      <td className="px-6 py-3.5">
                        {lead.pipeline_stages?.label ? (
                          <span
                            className="rounded-full px-2 py-1 text-xs font-medium"
                            style={{
                              backgroundColor: `${stageColor}1a`,
                              color: stageColor,
                            }}
                          >
                            {lead.pipeline_stages.label}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-3.5">
                        {isJunk ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                            Junk
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Owner */}
                      <td className="px-6 py-3.5 text-sm text-gray-600">
                        {lead.owner || "—"}
                      </td>

                      {/* Created */}
                      <td className="px-6 py-3.5 text-xs text-gray-400">
                        {formatDate(lead.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="rounded-lg border border-[#1a5c4f] px-3 py-1.5 text-xs font-semibold text-[#1a5c4f] transition hover:bg-[#1a5c4f] hover:text-white"
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
            <p className="text-xs text-gray-400">
              Showing{" "}
              <span className="font-semibold text-gray-600">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-600">
                {filtered.length}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-gray-500">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over detail panel */}
      <LeadSlideOver lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </>
  );
}
