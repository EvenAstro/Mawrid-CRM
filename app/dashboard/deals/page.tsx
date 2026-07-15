"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon } from "@/components/navIcons";

interface Deal {
  id: string;
  name: string | null;
  stage_id: string | null;
  expected_value_minor: number | null;
  won_value_minor: number | null;
  currency_code: string | null;
  probability_pct: number | null;
  pipeline_stages: { label: string; color: string | null; terminal_type: string | null } | null;
  lost_reasons: { label: string } | null;
}
interface StageCol {
  id: string;
  label: string;
  color: string | null;
  sort_order: number;
}

const nf = new Intl.NumberFormat("en-US");
function dealValue(d: Deal): string {
  const minor = d.won_value_minor ?? d.expected_value_minor;
  if (minor == null) return "—";
  const v = minor / 100;
  const c = d.currency_code || "SAR";
  return `${c} ${v >= 1000 ? Math.round(v / 1000) + "K" : nf.format(Math.round(v))}`;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [stages, setStages] = useState<StageCol[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const [d, s] = await Promise.all([
        supabase
          .from("deals")
          .select("*, pipeline_stages(label, color, terminal_type), lost_reasons(label)")
          .is("deleted_at", null),
        supabase.from("pipeline_stages").select("*").eq("pipeline", "deal").order("sort_order"),
      ]);
      if (d.data) setDeals(d.data as unknown as Deal[]);
      if (s.data) setStages(s.data as unknown as StageCol[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deals;
    return deals.filter((d) => (d.name ?? "").toLowerCase().includes(q));
  }, [deals, search]);

  const columns = useMemo(() => {
    return stages.map((st) => ({
      stage: st,
      deals: filtered.filter((d) => d.stage_id === st.id),
    }));
  }, [stages, filtered]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-[#1e1b4b]">Deals</h1>
        <p className="text-[15px] text-[#6b7280]">
          {loading ? "Loading…" : `${deals.length} deals across ${stages.length} stages`}
        </p>
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
            placeholder="Search deals…"
            className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-4 text-[15px] text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/20"
          />
        </div>
        <button className="rounded-lg bg-[#1a5c4f] px-4 text-[15px] font-semibold text-white transition hover:bg-[#15503f]">
          Search
        </button>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 w-[280px] flex-none animate-pulse rounded-xl bg-[#f1f5f9]" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map(({ stage, deals: colDeals }) => {
            const accent = stage.color || "#1a5c4f";
            return (
              <div key={stage.id} className="flex w-[280px] flex-none flex-col">
                <div className="mb-2 flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-[#1e1b4b]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                    {stage.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[13px] font-semibold text-[#6b7280]">
                    {colDeals.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {colDeals.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#e5e7eb] py-6 text-center text-[13px] text-[#9ca3af]">
                      No deals
                    </p>
                  ) : (
                    colDeals.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-lg border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                        style={{ borderLeft: `3px solid ${accent}` }}
                      >
                        <p className="truncate text-[15px] font-semibold text-[#1e1b4b]">
                          {d.name || "Untitled deal"}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[15px] font-bold text-[#1a5c4f]">{dealValue(d)}</span>
                          {d.probability_pct != null && d.probability_pct > 0 && (
                            <span className="rounded-full bg-[#f0faf8] px-2 py-0.5 text-[11px] font-bold text-[#1a5c4f]">
                              AI {d.probability_pct}%
                            </span>
                          )}
                        </div>
                        {d.pipeline_stages?.terminal_type === "lost" && d.lost_reasons?.label && (
                          <p className="mt-2 rounded bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            {d.lost_reasons.label}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
