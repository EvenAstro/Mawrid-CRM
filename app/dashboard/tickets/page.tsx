"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon } from "@/components/navIcons";

interface Ticket {
  id: string;
  type: string | null;
  title: string | null;
  priority: string | null;
  status: string | null;
  created_at: string | null;
  closed_at: string | null;
}

function shortDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function titleize(s: string | null) {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function statusStyle(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "resolved" || s === "closed" || s === "done")
    return "bg-green-50 text-green-700";
  if (s === "in_progress" || s === "pending") return "bg-amber-50 text-amber-700";
  return "border border-[#1a5c4f]/20 bg-[#f0faf8] text-[#1a5c4f]"; // open / default
}
function priorityStyle(priority: string | null) {
  const p = (priority ?? "").toLowerCase();
  if (p === "high" || p === "urgent" || p === "critical") return "bg-red-50 text-red-700";
  if (p === "medium") return "bg-amber-50 text-amber-700";
  return "bg-[#f1f5f9] text-[#6b7280]";
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setTickets(data as unknown as Ticket[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        (t.title ?? "").toLowerCase().includes(q) ||
        (t.type ?? "").toLowerCase().includes(q),
    );
  }, [tickets, search]);

  const openCount = tickets.filter(
    (t) => !["resolved", "closed", "done"].includes((t.status ?? "").toLowerCase()),
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-[#1e1b4b]">Tickets</h1>
          <p className="text-[15px] text-[#6b7280]">
            {loading ? "Loading…" : `${openCount} open · ${tickets.length} total`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-4 text-[15px] text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/20"
          />
        </div>
        <button className="rounded-lg bg-[#1a5c4f] px-4 text-[15px] font-semibold text-white transition hover:bg-[#15503f]">
          Search
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-white text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Priority</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-[15px] text-[#9ca3af]">
                    Loading tickets…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-[15px] text-[#9ca3af]">
                    No tickets found.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-[#f1f5f9] transition-colors last:border-0 hover:bg-[#f8fafc]">
                    <td className="max-w-[320px] px-6 py-3.5">
                      <p className="truncate text-[15px] font-semibold text-[#1e1b4b]">{t.title || "Untitled"}</p>
                    </td>
                    <td className="px-6 py-3.5 text-[15px] text-[#6b7280]">{titleize(t.type)}</td>
                    <td className="px-6 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium capitalize ${priorityStyle(t.priority)}`}>
                        {t.priority || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[13px] font-medium capitalize ${statusStyle(t.status)}`}>
                        {t.status || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[13px] text-[#9ca3af]">{shortDate(t.created_at)}</td>
                    <td className="px-6 py-3.5 text-right">
                      <button className="rounded-lg border border-[#1a5c4f] px-3 py-1.5 text-[13px] font-semibold text-[#1a5c4f] transition hover:bg-[#f0faf8]">
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
