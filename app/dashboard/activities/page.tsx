"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SearchIcon } from "@/components/navIcons";

interface Activity {
  id: string;
  body: string | null;
  occurred_at: string | null;
  direction: string | null;
  entity_type: string | null;
  entity_id: string | null;
  activity_types: { label: string; color: string | null } | null;
}

function dateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} at ${time}`;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leadNames, setLeadNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("activities")
        .select("*, activity_types(label, color)")
        .order("occurred_at", { ascending: false })
        .limit(100);
      const list = (data as unknown as Activity[]) || [];
      setActivities(list);

      const leadIds = Array.from(
        new Set(list.filter((a) => a.entity_type === "lead" && a.entity_id).map((a) => a.entity_id as string)),
      );
      if (leadIds.length) {
        const { data: leads } = await supabase.from("leads").select("id, full_name").in("id", leadIds);
        const map: Record<string, string> = {};
        (leads as { id: string; full_name: string | null }[] | null)?.forEach((l) => {
          if (l.full_name) map[l.id] = l.full_name;
        });
        setLeadNames(map);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter(
      (a) =>
        (a.body ?? "").toLowerCase().includes(q) ||
        (a.activity_types?.label ?? "").toLowerCase().includes(q),
    );
  }, [activities, search]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-[#1e1b4b]">Activities</h1>
          <p className="text-[15px] text-[#6b7280]">Latest touchpoints across your CRM</p>
        </div>
        <span className="rounded-full bg-[#f0faf8] px-3 py-1 text-[15px] font-semibold text-[#1a5c4f]">
          {loading ? "…" : `${activities.length} activities`}
        </span>
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
            placeholder="Search activity…"
            className="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-4 text-[15px] text-[#374151] placeholder:text-[#9ca3af] focus:border-[#1a5c4f] focus:outline-none focus:ring-2 focus:ring-[#1a5c4f]/20"
          />
        </div>
        <button className="rounded-lg bg-[#1a5c4f] px-4 text-[15px] font-semibold text-white transition hover:bg-[#15503f]">
          Search
        </button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        {loading ? (
          <div className="p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="mb-3 h-10 animate-pulse rounded bg-[#f1f5f9]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-[15px] text-[#9ca3af]">No activities found.</p>
        ) : (
          <div className="flex flex-col">
            {filtered.map((a) => {
              const leadName = a.entity_id ? leadNames[a.entity_id] : undefined;
              return (
                <div key={a.id} className="flex gap-3 border-b border-[#f1f5f9] px-5 py-4 last:border-0">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[#1a5c4f]" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {a.activity_types?.label && (
                        <span className="rounded-full bg-[#f0faf8] px-2 py-0.5 text-[12px] font-semibold text-[#1a5c4f]">
                          {a.activity_types.label}
                        </span>
                      )}
                      {leadName ? (
                        <span className="text-[13px] font-semibold text-[#1a5c4f]">{leadName}</span>
                      ) : (
                        a.entity_type && (
                          <span className="text-[13px] capitalize text-[#9ca3af]">{a.entity_type}</span>
                        )
                      )}
                      {a.direction && (
                        <span className="rounded-full bg-[#f1f5f9] px-1.5 py-0.5 text-[11px] font-medium text-[#9ca3af]">
                          {a.direction}
                        </span>
                      )}
                    </div>
                    <p dir="auto" className="text-[15px] text-[#374151]">{a.body || "—"}</p>
                    <p className="mt-1 text-[12px] text-[#9ca3af]">{dateTime(a.occurred_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
