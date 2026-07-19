"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LeadsIcon, CheckCircleIcon, RevenueIcon } from "@/components/navIcons";
import { downloadCSV } from "@/lib/format";
import Skeleton from "@/components/ui/Skeleton";

type Stage = { label: string; terminal_type: string | null } | null;
type Ref = { label: string } | null;
interface Lead { id: string; created_at: string | null; junk_reason_id: number | null; sources: Ref }
interface Deal { id: string; owner_id: string | null; expected_value_minor: number | null; won_value_minor: number | null; pipeline_stages: Stage; lost_reasons: Ref }
interface Activity { entity_type: string | null; entity_id: string | null; occurred_at: string | null }
interface CrmUser { id: string; name?: string | null; full_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }

const nf = new Intl.NumberFormat("en-US");
const sar = (minor: number) => "SAR " + nf.format(Math.round(minor / 100));
function userName(u: CrmUser | undefined, id: string): string {
  if (u) return u.name || u.full_name || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || `Rep ${id.slice(0, 4)}`;
  return `Rep ${id.slice(0, 4)}`;
}

function XCircle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className={className}>
      <circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

function KpiCard({ label, value, color, Icon }: { label: string; value: string; color: string; Icon: (p: { className?: string }) => React.ReactElement }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">{label}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-5xl font-black tabular-nums text-[#1e1b4b]">{value}</p>
    </div>
  );
}

function Panel({ title, subtitle, children, className = "", onExport }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; onExport?: () => void }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white p-6 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-bold text-[#1e1b4b]">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-[#94a3b8]">{subtitle}</p>}
        </div>
        {onExport && (
          <button onClick={onExport} className="flex-none rounded-full border border-gray-100 px-3 py-1 text-[12px] font-semibold text-[#475569] transition hover:border-primary hover:text-primary">
            ↓ CSV
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [l, d, a, u] = await Promise.all([
        supabase.from("leads").select("id, created_at, junk_reason_id, sources(label)").is("deleted_at", null),
        supabase.from("deals").select("id, owner_id, expected_value_minor, won_value_minor, pipeline_stages(label, terminal_type), lost_reasons(label)").is("deleted_at", null),
        supabase.from("activities").select("entity_type, entity_id, occurred_at").eq("entity_type", "lead"),
        supabase.from("crm_users").select("*"),
      ]);
      if (l.data) setLeads(l.data as unknown as Lead[]);
      if (d.data) setDeals(d.data as unknown as Deal[]);
      if (a.data) setActivities(a.data as unknown as Activity[]);
      if (u.data) setUsers(u.data as unknown as CrmUser[]);
      setLoading(false);
    }
    load();
  }, []);

  const s = useMemo(() => {
    const total = leads.length;
    const junk = leads.filter((l) => l.junk_reason_id != null).length;
    const clean = total - junk;
    const won = deals.filter((d) => d.pipeline_stages?.terminal_type === "won").length;
    const lost = deals.filter((d) => d.pipeline_stages?.terminal_type === "lost").length;

    const cnt: Record<string, number> = {};
    const jnk: Record<string, number> = {};
    leads.forEach((l) => {
      const k = l.sources?.label ?? "Unknown";
      cnt[k] = (cnt[k] ?? 0) + 1;
      if (l.junk_reason_id != null) jnk[k] = (jnk[k] ?? 0) + 1;
    });
    const bySource = Object.entries(cnt).map(([label, count]) => ({ label, count, junk: jnk[label] ?? 0, clean: count - (jnk[label] ?? 0) })).sort((a, b) => b.count - a.count);

    const umap = new Map(users.map((u) => [String(u.id), u]));
    const rmap: Record<string, { deals: number; won: number; lost: number }> = {};
    deals.forEach((d) => {
      const k = String(d.owner_id ?? "none");
      if (!rmap[k]) rmap[k] = { deals: 0, won: 0, lost: 0 };
      rmap[k].deals++;
      if (d.pipeline_stages?.terminal_type === "won") rmap[k].won++;
      if (d.pipeline_stages?.terminal_type === "lost") rmap[k].lost++;
    });
    const reps = Object.entries(rmap).map(([id, r]) => ({ name: id === "none" ? "Unassigned" : userName(umap.get(id), id), ...r, winRate: r.deals ? (r.won / r.deals) * 100 : 0 })).sort((a, b) => b.deals - a.deals).slice(0, 8);

    const funnel = [
      { label: "Total Leads", count: total, color: "#1a5c4f" },
      { label: "Active", count: clean, color: "#2d8a6e" },
      { label: "Deals Created", count: deals.length, color: "#f59e0b" },
      { label: "Lost", count: lost, color: "#ef4444" },
      { label: "Won", count: won, color: "#10b981" },
    ];

    const lrm: Record<string, { count: number; value: number }> = {};
    deals.forEach((d) => {
      if (!d.lost_reasons?.label) return;
      const k = d.lost_reasons.label;
      if (!lrm[k]) lrm[k] = { count: 0, value: 0 };
      lrm[k].count++;
      lrm[k].value += d.won_value_minor ?? d.expected_value_minor ?? 0;
    });
    const lostReasons = Object.entries(lrm).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.count - a.count);

    const firstAct: Record<string, number> = {};
    activities.forEach((a) => {
      if (!a.entity_id || !a.occurred_at) return;
      const t = new Date(a.occurred_at).getTime();
      if (Number.isNaN(t)) return;
      if (firstAct[a.entity_id] == null || t < firstAct[a.entity_id]) firstAct[a.entity_id] = t;
    });
    const agg: Record<string, { sum: number; n: number }> = {};
    leads.forEach((l) => {
      if (!l.created_at) return;
      const fa = firstAct[l.id];
      if (fa == null) return;
      const hrs = (fa - new Date(l.created_at).getTime()) / 3600000;
      if (hrs < 0 || Number.isNaN(hrs)) return;
      const k = l.sources?.label ?? "Unknown";
      if (!agg[k]) agg[k] = { sum: 0, n: 0 };
      agg[k].sum += hrs;
      agg[k].n++;
    });
    const respMap: Record<string, number> = {};
    Object.entries(agg).forEach(([k, v]) => (respMap[k] = v.n ? v.sum / v.n : 0));
    const responseRows = Object.entries(respMap).map(([label, hours]) => ({ label, hours })).sort((a, b) => a.hours - b.hours);

    const rv = Object.values(respMap);
    const minR = rv.length ? Math.min(...rv) : 0;
    const maxR = rv.length ? Math.max(...rv) : 0;
    const ranking = bySource.map((src) => {
      const junkRate = src.count ? src.junk / src.count : 0;
      const resp = respMap[src.label] ?? maxR;
      const norm = maxR > minR ? (resp - minR) / (maxR - minR) : 0;
      const score = (1 - junkRate) * 0.4 + (1 - norm) * 0.6;
      return { label: src.label, junkRate, response: respMap[src.label] ?? null, score };
    }).sort((a, b) => b.score - a.score);

    return { total, junk, clean, won, lost, activeDeals: deals.length, bySource, reps, funnel, lostReasons, responseRows, ranking };
  }, [leads, deals, activities, users]);

  if (loading)
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      </div>
    );

  const maxSource = Math.max(1, ...s.bySource.map((x) => x.count));
  const maxLost = Math.max(1, ...s.lostReasons.map((x) => x.count));
  const maxResp = Math.max(1, ...s.responseRows.map((x) => x.hours));
  const medals = ["🥇", "🥈", "🥉"];
  const medalBorder = ["#f5c518", "#c0c0c0", "#cd7f32"];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 dir="auto" className="text-2xl font-extrabold text-[#1e1b4b]">التحليلات</h1>
        <p className="mt-1 text-[15px] text-[#94a3b8]">رؤى فورية من بيانات نظامك</p>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <KpiCard label="Total Leads" value={String(s.total)} color="#1a5c4f" Icon={LeadsIcon} />
        <KpiCard label="Clean Leads" value={String(s.clean)} color="#10b981" Icon={CheckCircleIcon} />
        <KpiCard label="Junk Leads" value={String(s.junk)} color="#ef4444" Icon={XCircle} />
        <KpiCard label="Active Deals" value={String(s.activeDeals)} color="#f59e0b" Icon={RevenueIcon} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Leads by Source" onExport={() => downloadCSV("leads-by-source.csv", s.bySource.map((x) => ({ source: x.label, count: x.count, clean: x.clean, junk: x.junk })))}>
          {s.bySource.length === 0 ? <p className="py-8 text-center text-sm text-[#94a3b8]">No data</p> : (
            <div>
              {s.bySource.map((src) => (
                <div key={src.label} className="mb-3">
                  <div className="mb-1 flex justify-between">
                    <span className="text-sm text-[#475569]">{src.label}</span>
                    <span className="text-sm font-semibold text-[#1e1b4b]">{src.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#f1f5f9]"><div className="h-full rounded-full bg-[#1a5c4f]" style={{ width: `${(src.count / maxSource) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Sales Rep Performance" onExport={() => downloadCSV("rep-performance.csv", s.reps.map((r) => ({ rep: r.name, deals: r.deals, won: r.won, lost: r.lost, win_pct: Math.round(r.winRate) })))}>
          {s.reps.length === 0 ? <p className="py-8 text-center text-sm text-[#94a3b8]">No data</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="text-xs uppercase tracking-wider text-[#94a3b8]"><th className="pb-2">Rep</th><th className="pb-2 text-center">Deals</th><th className="pb-2 text-center">Won</th><th className="pb-2 text-center">Lost</th><th className="pb-2 text-right">Win %</th></tr></thead>
                <tbody>
                  {s.reps.map((r, index) => {
                    const wr = Math.round(r.winRate);
                    const cls = wr >= 20 ? "bg-green-50 text-green-700" : wr >= 1 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
                    return (
                      <tr key={`rep-${r.name}-${index}`} className="border-t border-gray-50">
                        <td className="py-2 font-medium text-[#334155]">{r.name}</td>
                        <td className="py-2 text-center text-[#475569]">{r.deals}</td>
                        <td className="py-2 text-center text-[#475569]">{r.won}</td>
                        <td className="py-2 text-center text-[#475569]">{r.lost}</td>
                        <td className="py-2 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{wr}%</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Sales Funnel">
          <div className="flex flex-col gap-2.5">
            {s.funnel.map((f) => {
              const pct = s.total ? Math.round((f.count / s.total) * 100) : 0;
              const tiny = pct < 16;
              return (
                <div key={f.label} className="flex h-9 items-center">
                  <div className="flex h-full min-w-[4px] items-center rounded-lg px-2.5" style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: f.color }}>
                    {!tiny && <span className="truncate text-xs font-semibold text-white">{f.label} · {f.count} · {pct}%</span>}
                  </div>
                  {tiny && <span className="ml-2 text-xs text-[#475569]">{f.label} · {f.count} · {pct}%</span>}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Lead Quality by Source">
          {s.bySource.length === 0 ? <p className="py-8 text-center text-sm text-[#94a3b8]">No data</p> : (
            <div className="flex flex-col gap-3">
              {s.bySource.map((src) => (
                <div key={src.label}>
                  <p className="mb-1 text-sm text-[#475569]">{src.label}</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2"><div className="h-2.5 flex-1 rounded-full bg-[#f1f5f9]"><div className="h-full rounded-full bg-green-500" style={{ width: `${(src.clean / maxSource) * 100}%` }} /></div><span className="w-7 text-right text-xs text-green-700">{src.clean}</span></div>
                    <div className="flex items-center gap-2"><div className="h-2.5 flex-1 rounded-full bg-[#f1f5f9]"><div className="h-full rounded-full bg-red-500" style={{ width: `${(src.junk / maxSource) * 100}%` }} /></div><span className="w-7 text-right text-xs text-red-700">{src.junk}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Why We Lose Deals" onExport={() => downloadCSV("lost-reasons.csv", s.lostReasons.map((r) => ({ reason: r.label, count: r.count, value_sar: Math.round(r.value / 100) })))}>
          {s.lostReasons.length === 0 ? <p className="py-8 text-center text-sm text-[#94a3b8]">No lost deals</p> : (
            <div className="flex flex-col gap-3">
              {s.lostReasons.map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex justify-between"><span className="text-sm text-[#475569]">{r.label}</span><span className="text-xs text-[#94a3b8]">{r.count} · {sar(r.value)}</span></div>
                  <div className="h-2 rounded-full bg-[#f1f5f9]"><div className="h-full rounded-full bg-red-500" style={{ width: `${(r.count / maxLost) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Response Time by Source" onExport={() => downloadCSV("response-time.csv", s.responseRows.map((r) => ({ source: r.label, avg_hours: Math.round(r.hours) })))}>
          {s.responseRows.length === 0 ? <p className="py-8 text-center text-sm text-[#94a3b8]">No data</p> : (
            <div className="flex flex-col gap-3">
              {s.responseRows.map((r) => {
                const color = r.hours < 50 ? "#10b981" : r.hours <= 150 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={r.label}>
                    <div className="mb-1 flex justify-between"><span className="text-sm text-[#475569]">{r.label}</span><span className="text-sm font-semibold text-[#1e1b4b]">{Math.round(r.hours)}h</span></div>
                    <div className="h-2 rounded-full bg-[#f1f5f9]"><div className="h-full rounded-full" style={{ width: `${(r.hours / maxResp) * 100}%`, backgroundColor: color }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="🏆 Source Ranking">
        {s.ranking.length === 0 ? <p className="py-8 text-center text-sm text-[#94a3b8]">No data</p> : (
          <div className="flex flex-wrap gap-4">
            {s.ranking.map((r, i) => {
              const isLast = i === s.ranking.length - 1 && s.ranking.length > 3;
              const topColor = isLast ? "#ef4444" : medalBorder[i] ?? "#e8ece9";
              const badge = isLast ? "🔴" : medals[i] ?? `#${i + 1}`;
              return (
                <div key={r.label} className="min-w-[160px] flex-1 rounded-xl border border-gray-100 bg-white p-4 shadow-sm" style={{ borderTop: `4px solid ${topColor}` }}>
                  <div className="mb-1 flex items-center justify-between"><span className="text-lg">{badge}</span><span className="text-xs font-medium text-[#94a3b8]">#{i + 1}</span></div>
                  <p className="font-bold text-[#1e1b4b]">{r.label}</p>
                  <p className="mt-1 text-sm text-[#475569]">Junk: {Math.round(r.junkRate * 100)}%</p>
                  <p className="text-sm text-[#475569]">Response: {r.response == null ? "—" : `${Math.round(r.response)}h`}</p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
