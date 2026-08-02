"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Directive {
  id: string;
  type: "urgent" | "warning" | "remind" | "praise";
  icon: string;
  message: string;
  action?: string;
  actionHref?: string;
}

interface Stats {
  completedToday: number;
  pendingToday: number;
  overdueCount: number;
  outboundToday: number;
  staleCount: number;
}

interface CoachData {
  directives: Directive[];
  aiSummary: string;
  stats: Stats;
}

const TYPE_STYLES = {
  urgent:  { border: "border-r-red-500",    bg: "bg-red-50/60",    badge: "bg-red-100 text-red-700",    label: "عاجل" },
  warning: { border: "border-r-amber-400",  bg: "bg-amber-50/40",  badge: "bg-amber-100 text-amber-700", label: "انتبه" },
  remind:  { border: "border-r-blue-400",   bg: "bg-blue-50/30",   badge: "bg-blue-100 text-blue-700",  label: "تذكير" },
  praise:  { border: "border-r-emerald-400", bg: "bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-700", label: "أحسنت" },
};

function StatPill({ icon, value, label, alert }: { icon: string; value: number; label: string; alert?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 ${
      alert ? "border-red-200 bg-red-50" : "border-[#d6ece5] bg-white"
    }`}>
      <span className="text-lg">{icon}</span>
      <div>
        <span className={`text-[20px] font-black tabular-nums ${alert ? "text-red-600" : "text-[#1e1b4b]"}`}>{value}</span>
        <span className="mr-1 text-[12px] text-[#94a3b8]">{label}</span>
      </div>
    </div>
  );
}

export default function CoachPage() {
  const router = useRouter();
  const [data, setData] = useState<CoachData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch(`/api/rep-coach?userId=${user.id}`);
      if (!res.ok) throw new Error("fetch failed");
      setData(await res.json());
      setDismissed(new Set());
    } catch (e) {
      console.error("[Coach] load failed", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-24 animate-pulse rounded-2xl border border-[#d6ece5] bg-white" />
        <div className="flex gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 w-32 animate-pulse rounded-xl border border-[#d6ece5] bg-white" />)}
        </div>
        {[1,2,3,4,5].map(i => <div key={i} className="h-20 animate-pulse rounded-xl border border-[#d6ece5] bg-white" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-[#1e1b4b]">تعذّر تحميل بيانات المشرف</h2>
        <button onClick={load} className="rounded-xl bg-[#1a5c4f] px-6 py-2.5 text-sm font-semibold text-white">إعادة المحاولة</button>
      </div>
    );
  }

  const { directives, aiSummary, stats } = data;
  const visible = directives.filter((d) => !dismissed.has(d.id));
  const urgentCount = visible.filter((d) => d.type === "urgent").length;
  const hour = new Date().getHours();
  const greeting = hour < 10 ? "صباح الخير" : hour < 16 ? "أهلاً" : "مساء الخير";

  return (
    <div className="flex flex-col gap-5">
      {/* Supervisor Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141c2e] text-2xl shadow-lg">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-black text-[#1e1b4b]">المشرف الذكي</h1>
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                يراقب
              </span>
            </div>
            <p className="text-[13px] text-[#94a3b8]">{greeting} — هذي أهم الأشياء اللي تحتاج تسويها</p>
          </div>
        </div>
        <button onClick={load} className="rounded-xl border border-[#d6ece5] bg-white px-4 py-2 text-[13px] font-semibold text-[#475569] transition hover:bg-[#f0faf8] hover:text-[#1a5c4f]">
          تحديث ↻
        </button>
      </div>

      {/* AI Summary Banner */}
      <div className="rounded-2xl border border-[#d6ece5] bg-gradient-to-l from-[#141c2e] to-[#1a3a4a] p-5 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl">💬</span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">كلمة المشرف</p>
            <p className="mt-1.5 text-[16px] font-semibold leading-relaxed">{aiSummary}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex flex-wrap gap-3">
        <StatPill icon="✅" value={stats.completedToday} label="أنجزت" />
        <StatPill icon="📋" value={stats.pendingToday} label="باقي اليوم" alert={stats.pendingToday > 5} />
        <StatPill icon="🔴" value={stats.overdueCount} label="متأخرة" alert={stats.overdueCount > 0} />
        <StatPill icon="📞" value={stats.outboundToday} label="تواصل" />
        <StatPill icon="⚠️" value={stats.staleCount} label="صفقات واقفة" alert={stats.staleCount > 0} />
      </div>

      {/* Directives Feed */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-[#d6ece5] bg-white py-12 text-center">
          <span className="text-4xl">🎉</span>
          <p className="mt-3 text-[16px] font-bold text-[#1e1b4b]">ما عندك شيء عالق!</p>
          <p className="mt-1 text-[13px] text-[#94a3b8]">خلّصت كل المطلوب — دوّر فرص جديدة</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {urgentCount > 0 && (
            <div className="flex items-center gap-2 text-[13px] font-bold text-red-600">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              عندك {urgentCount} {urgentCount === 1 ? "شيء عاجل" : "أشياء عاجلة"}
            </div>
          )}
          {visible.map((d) => {
            const style = TYPE_STYLES[d.type];
            return (
              <div
                key={d.id}
                className={`group relative flex items-start gap-4 rounded-xl border border-[#e8ece9] border-r-4 ${style.border} ${style.bg} p-4 transition-all hover:shadow-md`}
              >
                <span className="mt-0.5 text-xl flex-shrink-0">{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>{style.label}</span>
                  </div>
                  <p className="text-[14px] font-medium leading-relaxed text-[#1e1b4b]">{d.message}</p>
                  {d.action && d.actionHref && (
                    <button
                      onClick={() => router.push(d.actionHref!)}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#1a5c4f] px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#145043]"
                    >
                      {d.action} ←
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setDismissed((prev) => new Set(prev).add(d.id))}
                  className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[#94a3b8] opacity-0 transition-opacity hover:bg-white hover:text-[#475569] group-hover:opacity-100"
                  title="تم"
                >
                  ✓
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
