"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LeadsIcon, DealsIcon } from "@/components/navIcons";

/* ---------- Types ---------- */
type Stage = { label: string; terminal_type: string | null } | null;
type Ref = { label: string } | null;

interface Lead {
  id: number | string;
  junk_reason_id: number | null;
  created_at: string | null;
  source_id: number | null;
  owner_id: number | string | null;
  sources: Ref;
  pipeline_stages: Stage;
  junk_reasons: Ref;
}
interface Deal {
  id: number | string;
  owner_id: number | string | null;
  won_value_minor: number | null;
  pipeline_stages: Stage;
  lost_reasons: Ref;
}
interface Activity {
  id: number | string;
  lead_id: number | string | null;
  occurred_at: string | null;
}
interface CrmUser {
  id: number | string;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

/* ---------- Helpers ---------- */
const sar = (minor: number) =>
  "SAR " + new Intl.NumberFormat("en-US").format(Math.round(minor / 100));

function userName(u: CrmUser | undefined): string {
  if (!u) return "Unknown";
  return (
    u.name ||
    u.full_name ||
    [u.first_name, u.last_name].filter(Boolean).join(" ") ||
    u.email ||
    `User ${u.id}`
  );
}

/* ---------- KPI card ---------- */
function KpiCard({
  label,
  value,
  sub,
  tint,
  Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tint: string;
  Icon: () => React.ReactElement;
}) {
  return (
    <div className="rounded-2xl border border-[#e6f7f3] bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint}`}>
          <Icon />
        </span>
      </div>
      <p className="mt-4 text-3xl font-extrabold text-[#1e1b4b]">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-xs text-gray-400">{sub}</p>
    </div>
  );
}

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[#e6f7f3] bg-white p-5 shadow-sm ${className}`}>
      <h3 className="mb-4 text-base font-bold text-[#1e1b4b]">{title}</h3>
      {children}
    </div>
  );
}

function CheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4 4 10-10" />
    </svg>
  );
}
function XCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [crmUsers, setCrmUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [l, d, a, u] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "*, pipeline_stages(label, terminal_type), sources(label), junk_reasons(label)",
          )
          .is("deleted_at", null),
        supabase
          .from("deals")
          .select("*, pipeline_stages(label, terminal_type), lost_reasons(label)")
          .is("deleted_at", null),
        supabase.from("activities").select("*, activity_types(label)"),
        supabase.from("crm_users").select("*"),
      ]);
      if (l.data) setLeads(l.data as unknown as Lead[]);
      if (d.data) setDeals(d.data as unknown as Deal[]);
      if (a.data) setActivities(a.data as unknown as Activity[]);
      if (u.data) setCrmUsers(u.data as unknown as CrmUser[]);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const total = leads.length;
    const junk = leads.filter((l) => l.junk_reason_id != null).length;
    const clean = total - junk;

    // Trend: this month vs last month
    const now = new Date();
    const inMonth = (iso: string | null, offset: number) => {
      if (!iso) return false;
      const dt = new Date(iso);
      const ref = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return (
        dt.getFullYear() === ref.getFullYear() && dt.getMonth() === ref.getMonth()
      );
    };
    const leadsThisMonth = leads.filter((l) => inMonth(l.created_at, 0)).length;
    const leadsLastMonth = leads.filter((l) => inMonth(l.created_at, 1)).length;

    // Deals
    const wonDeals = deals.filter(
      (d) => d.pipeline_stages?.terminal_type === "won",
    );
    const lostDeals = deals.filter(
      (d) => d.pipeline_stages?.terminal_type === "lost",
    );
    const wonValue = wonDeals.reduce((s, d) => s + (d.won_value_minor ?? 0), 0);

    // Leads by source
    const sourceCount: Record<string, number> = {};
    const sourceJunk: Record<string, number> = {};
    leads.forEach((l) => {
      const key = l.sources?.label ?? "Unknown";
      sourceCount[key] = (sourceCount[key] ?? 0) + 1;
      if (l.junk_reason_id != null) sourceJunk[key] = (sourceJunk[key] ?? 0) + 1;
    });
    const leadsBySource = Object.entries(sourceCount)
      .map(([label, count]) => ({
        label,
        count,
        junk: sourceJunk[label] ?? 0,
        clean: count - (sourceJunk[label] ?? 0),
      }))
      .sort((a, b) => b.count - a.count);

    // Rep performance
    const userMap = new Map(crmUsers.map((u) => [String(u.id), u]));
    const repMap: Record<string, { deals: number; won: number; lost: number }> = {};
    deals.forEach((d) => {
      const key = String(d.owner_id ?? "none");
      if (!repMap[key]) repMap[key] = { deals: 0, won: 0, lost: 0 };
      repMap[key].deals++;
      if (d.pipeline_stages?.terminal_type === "won") repMap[key].won++;
      if (d.pipeline_stages?.terminal_type === "lost") repMap[key].lost++;
    });
    const reps = Object.entries(repMap)
      .map(([id, r]) => ({
        name: id === "none" ? "Unassigned" : userName(userMap.get(id)),
        ...r,
        winRate: r.deals ? (r.won / r.deals) * 100 : 0,
      }))
      .sort((a, b) => b.deals - a.deals);
    const repTotals = reps.reduce(
      (acc, r) => ({
        deals: acc.deals + r.deals,
        won: acc.won + r.won,
        lost: acc.lost + r.lost,
      }),
      { deals: 0, won: 0, lost: 0 },
    );

    // Funnel
    const funnel = [
      { label: "Total Leads", count: total, color: "#1a5c4f" },
      { label: "Active", count: clean, color: "#2d8a6e" },
      { label: "Deals Created", count: deals.length, color: "#f59e0b" },
      { label: "Lost", count: lostDeals.length, color: "#dc2626" },
      { label: "Won", count: wonDeals.length, color: "#059669" },
    ];

    // Lost reasons
    const lostReasonMap: Record<string, { count: number; value: number }> = {};
    deals.forEach((d) => {
      if (d.pipeline_stages?.terminal_type !== "lost" && !d.lost_reasons) return;
      if (!d.lost_reasons?.label) return;
      const key = d.lost_reasons.label;
      if (!lostReasonMap[key]) lostReasonMap[key] = { count: 0, value: 0 };
      lostReasonMap[key].count++;
      lostReasonMap[key].value += d.won_value_minor ?? 0;
    });
    const lostReasons = Object.entries(lostReasonMap)
      .map(([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.count - a.count);

    // Response time by source (hours from lead created -> first activity)
    const firstActivity: Record<string, number> = {};
    activities.forEach((a) => {
      if (a.lead_id == null || !a.occurred_at) return;
      const t = new Date(a.occurred_at).getTime();
      if (Number.isNaN(t)) return;
      const key = String(a.lead_id);
      if (firstActivity[key] == null || t < firstActivity[key])
        firstActivity[key] = t;
    });
    const respAgg: Record<string, { sum: number; n: number }> = {};
    leads.forEach((l) => {
      if (!l.created_at) return;
      const fa = firstActivity[String(l.id)];
      if (fa == null) return;
      const hours = (fa - new Date(l.created_at).getTime()) / 3600000;
      if (hours < 0 || Number.isNaN(hours)) return;
      const key = l.sources?.label ?? "Unknown";
      if (!respAgg[key]) respAgg[key] = { sum: 0, n: 0 };
      respAgg[key].sum += hours;
      respAgg[key].n++;
    });
    const responseBySource: Record<string, number> = {};
    Object.entries(respAgg).forEach(([k, v]) => {
      responseBySource[k] = v.n ? v.sum / v.n : 0;
    });
    const responseRows = Object.entries(responseBySource)
      .map(([label, hours]) => ({ label, hours }))
      .sort((a, b) => a.hours - b.hours);

    // Source ranking
    const respValues = Object.values(responseBySource);
    const minR = respValues.length ? Math.min(...respValues) : 0;
    const maxR = respValues.length ? Math.max(...respValues) : 0;
    const ranking = leadsBySource
      .map((s) => {
        const junkRate = s.count ? s.junk / s.count : 0;
        const resp = responseBySource[s.label] ?? maxR;
        const normResp = maxR > minR ? (resp - minR) / (maxR - minR) : 0;
        const score = (1 - junkRate) * 0.4 + (1 - normResp) * 0.6;
        return {
          label: s.label,
          junkRate,
          response: responseBySource[s.label] ?? null,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    return {
      total,
      junk,
      clean,
      leadsThisMonth,
      leadsLastMonth,
      dealsCount: deals.length,
      wonValue,
      leadsBySource,
      reps,
      repTotals,
      funnel,
      lostReasons,
      responseRows,
      ranking,
    };
  }, [leads, deals, activities, crmUsers]);

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        Loading analytics…
      </div>
    );
  }

  const maxSource = Math.max(1, ...stats.leadsBySource.map((s) => s.count));
  const maxSourceTotal = Math.max(1, ...stats.leadsBySource.map((s) => s.count));
  const maxLost = Math.max(1, ...stats.lostReasons.map((r) => r.count));
  const maxResp = Math.max(1, ...stats.responseRows.map((r) => r.hours));
  const medals = ["🥇", "🥈", "🥉"];
  const medalBorder = ["#f5c518", "#c0c0c0", "#cd7f32"];

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e1b4b]">Analytics</h1>
        <p className="text-sm text-gray-400">
          Real-time insights from your CRM data
        </p>
      </div>

      {/* Section 1 — KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Leads"
          value={String(stats.total)}
          sub={`${stats.leadsThisMonth} this month · ${stats.leadsLastMonth} last`}
          tint="bg-[#f0faf8] text-[#1a5c4f]"
          Icon={LeadsIcon}
        />
        <KpiCard
          label="Clean Leads"
          value={String(stats.clean)}
          sub={`${pct(stats.clean, stats.total)}% of total`}
          tint="bg-emerald-50 text-emerald-600"
          Icon={CheckCircle}
        />
        <KpiCard
          label="Junk Leads"
          value={String(stats.junk)}
          sub={`${pct(stats.junk, stats.total)}% of total`}
          tint="bg-red-50 text-red-600"
          Icon={XCircle}
        />
        <KpiCard
          label="Active Deals"
          value={String(stats.dealsCount)}
          sub={`${sar(stats.wonValue)} won`}
          tint="bg-[#f0faf8] text-[#1a5c4f]"
          Icon={DealsIcon}
        />
      </div>

      {/* Section 2 */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Leads by Source */}
        <Panel title="Leads by Source">
          {stats.leadsBySource.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.leadsBySource.map((s, i) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="w-24 flex-none truncate text-xs text-gray-500">
                    {s.label}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.count / maxSource) * 100}%`,
                        backgroundColor: "#1a5c4f",
                        opacity: Math.max(0.45, 1 - i * 0.12),
                      }}
                    />
                  </div>
                  <span className="w-8 flex-none text-right text-xs font-semibold text-gray-600">
                    {s.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Rep Performance */}
        <Panel title="Sales Rep Performance">
          {stats.reps.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="pb-2">Rep</th>
                    <th className="pb-2 text-center">Deals</th>
                    <th className="pb-2 text-center">Won</th>
                    <th className="pb-2 text-center">Lost</th>
                    <th className="pb-2 text-right">Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.reps.map((r) => {
                    const wr = Math.round(r.winRate);
                    const wrClass =
                      wr >= 20
                        ? "bg-emerald-50 text-emerald-600"
                        : wr >= 1
                          ? "bg-amber-50 text-amber-600"
                          : "bg-red-50 text-red-600";
                    return (
                      <tr key={r.name} className="border-t border-gray-50">
                        <td className="py-2 font-medium text-gray-700">
                          {r.name}
                        </td>
                        <td className="py-2 text-center text-gray-600">
                          {r.deals}
                        </td>
                        <td className="py-2 text-center text-gray-600">
                          {r.won}
                        </td>
                        <td className="py-2 text-center text-gray-600">
                          {r.lost}
                        </td>
                        <td className="py-2 text-right">
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${wrClass}`}
                          >
                            {wr}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-gray-100 font-bold text-[#1e1b4b]">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-center">{stats.repTotals.deals}</td>
                    <td className="py-2 text-center">{stats.repTotals.won}</td>
                    <td className="py-2 text-center">{stats.repTotals.lost}</td>
                    <td className="py-2 text-right">
                      {pct(stats.repTotals.won, stats.repTotals.deals)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Funnel */}
        <Panel title="Sales Funnel">
          <div className="flex flex-col gap-2.5">
            {stats.funnel.map((f) => {
              const width = pct(f.count, stats.total || 1);
              const tiny = width < 12;
              return (
                <div key={f.label}>
                  <div className="flex h-8 items-center">
                    <div
                      className="flex h-full min-w-[3px] items-center rounded-lg px-2"
                      style={{ width: `${Math.max(width, 2)}%`, backgroundColor: f.color }}
                    >
                      {!tiny && (
                        <span className="truncate text-xs font-semibold text-white">
                          {f.label} · {f.count} · {width}%
                        </span>
                      )}
                    </div>
                    {tiny && (
                      <span className="ml-2 text-xs font-medium text-gray-600">
                        {f.label} · {f.count} · {width}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Section 3 */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lead Quality by Source */}
        <Panel title="Lead Quality by Source">
          {stats.leadsBySource.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.leadsBySource.map((s) => (
                <div key={s.label}>
                  <p className="mb-1 text-xs text-gray-500">{s.label}</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${(s.clean / maxSourceTotal) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-[11px] text-emerald-600">
                        {s.clean}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${(s.junk / maxSourceTotal) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-[11px] text-red-600">
                        {s.junk}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Why We Lose Deals */}
        <Panel title="Why We Lose Deals">
          {stats.lostReasons.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No lost deals</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.lostReasons.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center gap-3"
                  title={`${r.count} deals · ${sar(r.value)}`}
                >
                  <span className="w-24 flex-none truncate text-xs text-gray-500">
                    {r.label}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(r.count / maxLost) * 100}%`,
                        backgroundColor: "#dc2626",
                      }}
                    />
                  </div>
                  <span className="w-8 flex-none text-right text-xs font-semibold text-gray-600">
                    {r.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Response Time by Source */}
        <Panel title="Response Time by Source">
          {stats.responseRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {stats.responseRows.map((r) => {
                const color =
                  r.hours < 50 ? "#1a5c4f" : r.hours <= 150 ? "#f59e0b" : "#dc2626";
                return (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="w-24 flex-none truncate text-xs text-gray-500">
                      {r.label}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(r.hours / maxResp) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="w-12 flex-none text-right text-xs font-semibold text-gray-600">
                      {Math.round(r.hours)}h
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Section 4 — Source Ranking */}
      <Panel title="🏆 Source Ranking">
        {stats.ranking.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No data</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {stats.ranking.map((s, i) => {
              const isLast = i === stats.ranking.length - 1 && stats.ranking.length > 3;
              const topColor = isLast
                ? "#dc2626"
                : medalBorder[i] ?? "#e6f7f3";
              const badge = isLast ? "🔴" : (medals[i] ?? `#${i + 1}`);
              return (
                <div
                  key={s.label}
                  className="min-w-[150px] flex-1 rounded-xl border border-[#e6f7f3] bg-white p-4 shadow-sm"
                  style={{ borderTop: `4px solid ${topColor}` }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-lg">{badge}</span>
                    <span className="text-xs font-medium text-gray-400">
                      #{i + 1}
                    </span>
                  </div>
                  <p className="font-bold text-[#1e1b4b]">{s.label}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Junk: {Math.round(s.junkRate * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    Avg Response:{" "}
                    {s.response == null ? "—" : `${Math.round(s.response)}h`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
