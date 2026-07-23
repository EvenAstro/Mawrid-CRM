"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import NextBestActionCard from "@/components/NextBestActionCard";
import { fetchLeadScoreModel, scoreWithModel } from "@/lib/leadScore/computeLeadScore";

export interface Lead {
  id: string | number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  owner: string | null;
  created_at: string | null;
  junk_reason_id: number | null;
  establishment_id?: number | string | null;
  establishment_name?: string | null;
  notes?: string | null;
  pipeline_stages: { label: string; color: string | null } | null;
  sources: { label: string } | null;
  junk_reasons: { label: string } | null;
}

interface Activity {
  id: number | string;
  occurred_at: string | null;
  body?: string | null;
  activity_types: { label: string } | null;
}

interface LeadScore {
  pJunk: number;
  pClean: number;
  score: number;
  isJunk: boolean;
  hasCampaign: boolean;
  matched: boolean;
  source: string;
}

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

function scoreColor(pct: number): string {
  if (pct >= 70) return "#059669";
  if (pct >= 40) return "#f59e0b";
  return "#dc2626";
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#94a3b8]">
        {label}
      </p>
      <p dir="auto" className="mt-0.5 text-[15px] font-medium text-[#1e1b4b]">{value || "—"}</p>
    </div>
  );
}

export default function LeadSlideOver({
  lead,
  onClose,
}: {
  lead: Lead | null;
  onClose: () => void;
}) {
  const [shown, setShown] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leadScore, setLeadScore] = useState<LeadScore | null>(null);

  const open = lead != null;

  // Keep last lead visible while sliding out
  useEffect(() => {
    if (lead) setShown(lead);
  }, [lead]);

  // Fetch touchpoints FIRST, then compute the score
  useEffect(() => {
    if (!lead) return;
    setActivities([]);
    setLeadScore(null);

    const fetchLeadDetails = async () => {
      const [tps, acts] = await Promise.all([
        supabase
          .from("lead_touchpoints")
          .select("campaign_id, raw_payload")
          .eq("lead_id", lead.id),
        supabase
          .from("activities")
          .select("*, activity_types(label)")
          .eq("entity_id", lead.id)
          .eq("entity_type", "lead")
          .order("occurred_at", { ascending: false })
          .limit(5),
      ]);

      setActivities((acts.data as unknown as Activity[]) || []);

      const has_campaign =
        tps.data?.some(
          (t: { campaign_id: string | null }) =>
            t.campaign_id && t.campaign_id !== "--",
        ) || false;
      const matched = !!lead.establishment_id;
      const source = lead.sources?.label || "غير محدد";

      const model = await fetchLeadScoreModel();
      const result = scoreWithModel(model, { source, matched, hasCampaign: has_campaign });

      setLeadScore({
        pJunk: result.pJunk,
        pClean: 1 - result.pJunk,
        score: result.score,
        isJunk: result.pJunk >= 0.5,
        hasCampaign: has_campaign,
        matched,
        source,
      });
    };

    fetchLeadDetails();
  }, [lead]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const data = shown;
  const R = 34;
  const CIRC = 2 * Math.PI * R;
  const color = leadScore ? scoreColor(leadScore.score) : "#1a5c4f";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-[520px] flex-col border-l border-[#e8ece9] bg-[#f8fafc] shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {data && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#e8ece9] p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#1a5c4f] text-lg font-bold text-white">
                  {initials(data.full_name)}
                </span>
                <div className="min-w-0">
                  <h2 dir="auto" className="truncate text-xl font-bold text-[#1e1b4b]">
                    {data.full_name || "Unnamed lead"}
                  </h2>
                  <p className="text-[15px] text-[#94a3b8]">{data.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {data.junk_reason_id != null ? (
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-[13px] font-medium text-red-700">
                    Junk
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-medium text-emerald-700">
                    Active
                  </span>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="text-[#94a3b8] transition hover:text-[#334155]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    className="h-5 w-5"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
              {/* AI Next Best Action — only shows when the lead has activity */}
              <NextBestActionCard dealId={String(data.id)} entityType="lead" hideWhenEmpty />

              {/* Section 1 — Lead info */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name" value={data.full_name} />
                <Field label="Company" value={data.establishment_name ?? null} />
                <Field label="Stage" value={data.pipeline_stages?.label ?? null} />
                <Field label="Source" value={data.sources?.label ?? null} />
                <Field label="Phone" value={data.phone} />
                <Field label="Email" value={data.email} />
                <Field label="Owner" value={data.owner} />
                <Field label="Created" value={formatDate(data.created_at)} />
                <div className="col-span-2">
                  <Field label="Notes" value={data.notes ?? null} />
                </div>
              </div>

              {/* Section 2 — AI Analysis: spinner while computing, then result */}
              {!leadScore && (
                <div className="flex items-center gap-3 rounded-2xl border border-[#e8ece9] bg-white p-5">
                  <svg className="h-5 w-5 animate-spin text-[#1a5c4f]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  <span className="text-[15px] font-medium text-[#334155]">Calculating AI lead score…</span>
                </div>
              )}
              {leadScore && (
                <div className="rounded-2xl border border-[#e8ece9] bg-gradient-to-br from-[#1a5c4f]/10 to-transparent p-5">
                  <h3 className="mb-4 font-semibold text-[#1e1b4b]">
                    🤖 AI Lead Score
                  </h3>

                  {/* Ring + bar */}
                  <div className="flex items-center gap-5">
                    <div className="relative flex-none">
                      <svg width="80" height="80" className="-rotate-90">
                        <circle cx="40" cy="40" r={R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
                        <circle
                          cx="40"
                          cy="40"
                          r={R}
                          fill="none"
                          stroke={color}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={CIRC}
                          strokeDashoffset={CIRC * (1 - leadScore.score / 100)}
                          style={{ transition: "stroke-dashoffset 0.5s ease" }}
                        />
                      </svg>
                      <span
                        className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold"
                        style={{ color }}
                      >
                        {leadScore.score}%
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-[#94a3b8]">
                        Clean Lead Probability
                      </p>
                      <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${leadScore.score}%`,
                            backgroundColor: color,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[13px] text-[#94a3b8]">
                        <span>p_junk: {Math.round(leadScore.pJunk * 100)}%</span>
                        <span>p_clean: {Math.round(leadScore.pClean * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Verdict */}
                  <div
                    className={`mt-4 rounded-xl border p-3 text-center text-[15px] font-medium ${
                      leadScore.isJunk
                        ? "border-red-100 bg-red-50 text-red-700"
                        : "border-green-100 bg-green-50 text-green-700"
                    }`}
                  >
                    {leadScore.isJunk
                      ? "🚫 Likely Junk Lead — Low sales priority"
                      : "✅ Promising Lead — Worth immediate follow-up"}
                  </div>

                  {/* Feature pills */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[13px] text-[#334155]">
                      📍 {leadScore.source}
                    </span>
                    {leadScore.hasCampaign ? (
                      <span className="rounded-full bg-[#f0faf8] px-3 py-1 text-[13px] text-[#1a5c4f]">
                        💰 Paid Campaign
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[13px] text-[#94a3b8]">
                        💰 Organic
                      </span>
                    )}
                    {leadScore.matched ? (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-[13px] text-green-700">
                        🏢 Company Matched
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[13px] text-[#94a3b8]">
                        🏢 No Match
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Section 3 — Recent activity */}
              <div>
                <h3 className="mb-3 text-[15px] font-semibold text-[#1e1b4b]">
                  Recent Activity
                </h3>
                {activities.length === 0 ? (
                  <p className="text-[13px] text-[#94a3b8]">No activity recorded</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {activities.map((a) => (
                      <div key={a.id} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 flex-none rounded-full bg-[#1a5c4f]" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#1e1b4b]">
                              {a.activity_types?.label ?? "Activity"}
                            </span>
                            <span className="text-[13px] text-[#94a3b8]">
                              {formatDate(a.occurred_at)}
                            </span>
                          </div>
                          {a.body && (
                            <p className="truncate text-[13px] text-[#94a3b8]">
                              {a.body}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
