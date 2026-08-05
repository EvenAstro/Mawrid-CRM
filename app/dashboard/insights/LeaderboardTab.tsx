"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchProfiles, type Profile } from "@/lib/profiles";
import { profileName, money } from "@/lib/format";
import Skeleton from "@/components/ui/Skeleton";

interface RepStats {
  userId: string;
  name: string;
  wonDeals: number;
  wonValueSAR: number;
  tasksCompleted: number;
  outboundActivities: number;
  /** Simple weighted score to rank by — revenue matters most, then
   * closed deals and completed tasks, then raw outreach volume. */
  score: number;
}

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

const MEDALS = ["🥇", "🥈", "🥉"];
const CARD = "rounded-2xl border border-[#d6ece5] bg-white shadow-[0_2px_8px_rgba(26,92,79,0.04)]";

export default function LeaderboardTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rows, setRows] = useState<RepStats[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(false);
      try {
        const since = monthStart();
        const [profiles, dealsRes, tasksRes, activitiesRes] = await Promise.all([
          fetchProfiles(),
          supabase
            .from("deals")
            .select("owner_id, won_value_minor, expected_value_minor, updated_at, pipeline_stages(terminal_type)")
            .is("deleted_at", null)
            .gte("updated_at", since),
          supabase
            .from("tasks")
            .select("assignee_uid, completed_at")
            .not("completed_at", "is", null)
            .gte("completed_at", since),
          supabase
            .from("activities")
            .select("user_id, direction, occurred_at")
            .eq("direction", "outbound")
            .gte("occurred_at", since),
        ]);

        if (cancelled) return;

        const salesReps = (profiles as Profile[]).filter((p) => p.role === "sales" || p.role === "manager" || p.role === "admin");
        const byId = new Map<string, RepStats>();
        salesReps.forEach((p) => {
          byId.set(p.id, { userId: p.id, name: profileName(p), wonDeals: 0, wonValueSAR: 0, tasksCompleted: 0, outboundActivities: 0, score: 0 });
        });

        type DealRow = { owner_id: string | null; won_value_minor: number | null; expected_value_minor: number | null; pipeline_stages: { terminal_type: string | null } | null };
        ((dealsRes.data as unknown as DealRow[]) ?? []).forEach((d) => {
          if (!d.owner_id || d.pipeline_stages?.terminal_type !== "won") return;
          const rep = byId.get(d.owner_id);
          if (!rep) return;
          rep.wonDeals += 1;
          rep.wonValueSAR += (d.won_value_minor ?? d.expected_value_minor ?? 0) / 100;
        });

        type TaskRow = { assignee_uid: string | null };
        ((tasksRes.data as unknown as TaskRow[]) ?? []).forEach((t) => {
          if (!t.assignee_uid) return;
          const rep = byId.get(t.assignee_uid);
          if (rep) rep.tasksCompleted += 1;
        });

        type ActivityRow = { user_id: string | null };
        ((activitiesRes.data as unknown as ActivityRow[]) ?? []).forEach((a) => {
          if (!a.user_id) return;
          const rep = byId.get(a.user_id);
          if (rep) rep.outboundActivities += 1;
        });

        const list = Array.from(byId.values()).map((r) => ({
          ...r,
          score: r.wonValueSAR * 1 + r.wonDeals * 500 + r.tasksCompleted * 50 + r.outboundActivities * 10,
        }));
        list.sort((a, b) => b.score - a.score);

        setRows(list);
      } catch (err) {
        console.error("[Leaderboard] failed to build", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxScore = useMemo(() => Math.max(1, ...rows.map((r) => r.score)), [rows]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${CARD} py-16 text-center`}>
        <p className="text-[14px] text-muted">تعذّر تحميل لوحة الأداء.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="relative overflow-hidden rounded-3xl bg-[#141c2e] p-8 text-white">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7ee7cd]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7ee7cd]">أداء الفريق</span>
        </div>
        <h1 dir="auto" className="text-[26px] font-extrabold leading-tight">لوحة أداء المندوبين — هذا الشهر</h1>
        <p dir="auto" className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/70">
          ترتيب مبني على قيمة الصفقات المربوحة، عدد الصفقات المغلقة، المهام المنجزة، والتواصل الصادر — كله من بيانات هذا الشهر الفعلية.
        </p>
      </section>

      {rows.length === 0 ? (
        <div className={`${CARD} py-16 text-center`}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mint text-xl">🏆</div>
          <p dir="auto" className="text-[14px] text-muted">ما فيه بيانات كافية لبناء لوحة الأداء بعد.</p>
        </div>
      ) : (
        <div className={`${CARD} flex flex-col divide-y divide-[#eef4f1] overflow-hidden`}>
          {rows.map((r, i) => (
            <div key={r.userId} className="flex items-center gap-4 p-5">
              <span className="flex h-9 w-9 flex-none items-center justify-center text-[20px]">
                {i < 3 ? MEDALS[i] : <span className="text-[13px] font-bold text-muted">{i + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p dir="auto" className="truncate text-[14px] font-bold text-ink">{r.name}</p>
                  <span dir="ltr" className="flex-none text-[13px] font-bold text-[#1a5c4f]">SAR {money(r.wonValueSAR)}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-[#1a5c4f]" style={{ width: `${(r.score / maxScore) * 100}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
                  <span>🏆 {r.wonDeals} صفقة مربوحة</span>
                  <span>✅ {r.tasksCompleted} مهمة منجزة</span>
                  <span>📞 {r.outboundActivities} تواصل صادر</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
