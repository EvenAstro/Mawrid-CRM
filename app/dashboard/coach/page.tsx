"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RepScoreData } from "@/lib/repScore";

interface CoachTip { icon: string; title: string; body: string }
interface CoachingData {
  summary: string;
  mood: "excellent" | "good" | "needs_work" | "critical";
  tips: CoachTip[];
  priority_action: string;
}
interface CoachPayload { score: RepScoreData; coaching: CoachingData }

const MOOD_CONFIG = {
  excellent: { label: "ممتاز", emoji: "🔥", gradient: "from-emerald-500 to-teal-600", ring: "ring-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700" },
  good:      { label: "جيد",   emoji: "💪", gradient: "from-blue-500 to-cyan-600",    ring: "ring-blue-200",    bg: "bg-blue-50",    text: "text-blue-700" },
  needs_work:{ label: "يحتاج تحسين", emoji: "⚡", gradient: "from-amber-500 to-orange-500", ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-700" },
  critical:  { label: "تحتاج تركيز", emoji: "🚨", gradient: "from-red-500 to-rose-600",    ring: "ring-red-200",    bg: "bg-red-50",    text: "text-red-700" },
};

function scoreColor(s: number) {
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#3b82f6";
  if (s >= 40) return "#f59e0b";
  return "#ef4444";
}

function ScoreRing({ score }: { score: number }) {
  const R = 58, C = 2 * Math.PI * R;
  const offset = C * (1 - score / 100);
  const color = scoreColor(score);
  return (
    <div className="relative flex h-[160px] w-[160px] items-center justify-center">
      <svg viewBox="0 0 140 140" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#e8f0ec" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="text-center">
        <span className="text-[48px] font-black tabular-nums" style={{ color }}>{score}</span>
        <span className="block text-[13px] font-semibold text-[#94a3b8]">من 100</span>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="group rounded-2xl border border-[#d6ece5] bg-gradient-to-bl from-white to-[#f5faf8] p-5 shadow-[0_2px_8px_rgba(26,92,79,0.04)] transition-all hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(26,92,79,0.08)]">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${accent}15` }}>
        {icon}
      </div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">{label}</p>
      <p className="mt-1 text-[28px] font-black leading-none tabular-nums text-[#1e1b4b]">{value}</p>
      {sub && <p className="mt-1 text-[12px] text-[#94a3b8]">{sub}</p>}
    </div>
  );
}

function TipCard({ tip, index }: { tip: CoachTip; index: number }) {
  const colors = ["border-l-emerald-400", "border-l-blue-400", "border-l-amber-400", "border-l-violet-400"];
  return (
    <div
      className={`rounded-xl border border-[#d6ece5] border-l-4 ${colors[index % colors.length]} bg-white p-5 shadow-[0_2px_8px_rgba(26,92,79,0.04)] transition-all hover:shadow-[0_4px_12px_rgba(26,92,79,0.08)]`}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-2xl">{tip.icon}</span>
        <div className="flex-1">
          <h4 className="text-[15px] font-bold text-[#1e1b4b]">{tip.title}</h4>
          <p className="mt-1 text-[13px] leading-relaxed text-[#475569]">{tip.body}</p>
        </div>
      </div>
    </div>
  );
}

function StaleItem({ name, days }: { name: string; days: number }) {
  const urgency = days >= 14 ? "bg-red-50 text-red-600" : days >= 7 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-600";
  return (
    <div className="flex items-center justify-between border-b border-[#e8f0ec] py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141c2e]">
          <span className="text-xs font-bold text-white">{name.charAt(0)}</span>
        </div>
        <span className="text-[14px] font-medium text-[#1e1b4b]">{name}</span>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${urgency}`}>{days} يوم</span>
    </div>
  );
}

function TaskItem({ title, status }: { title: string; status: "done" | "missed" }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#e8f0ec] py-2.5 last:border-0">
      <div className={`flex h-5 w-5 items-center justify-center rounded-full ${status === "done" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"}`}>
        {status === "done" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3"><path d="M20 6 9 17l-5-5" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3"><path d="M18 6 6 18M6 6l12 12" /></svg>
        )}
      </div>
      <span className={`flex-1 text-[13px] ${status === "done" ? "text-[#475569]" : "font-medium text-red-600"}`}>{title}</span>
    </div>
  );
}

const CARD = "rounded-2xl border border-[#d6ece5] bg-white p-6 shadow-[0_2px_8px_rgba(26,92,79,0.04)]";

export default function CoachPage() {
  const [data, setData] = useState<CoachPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const res = await fetch(`/api/rep-coach?userId=${user.id}`);
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setData(json);
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
      <div className="flex flex-col gap-6">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-white" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-80 animate-pulse rounded-2xl border border-[#d6ece5] bg-white lg:col-span-1" />
          <div className="h-80 animate-pulse rounded-2xl border border-[#d6ece5] bg-white lg:col-span-2" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl border border-[#d6ece5] bg-white" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">⚠️</div>
        <h2 className="text-xl font-bold text-[#1e1b4b]">تعذّر تحميل بيانات الأداء</h2>
        <button onClick={load} className="rounded-xl bg-[#1a5c4f] px-6 py-2.5 text-sm font-semibold text-white">إعادة المحاولة</button>
      </div>
    );
  }

  const { score: s, coaching: c } = data;
  const mood = MOOD_CONFIG[c.mood] || MOOD_CONFIG.good;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-black tracking-tight text-[#1e1b4b]">مدرب الأداء</h1>
            <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${mood.bg} ${mood.text}`}>
              {mood.emoji} {mood.label}
            </span>
          </div>
          <p className="mt-1 text-[14px] text-[#94a3b8]">تحليل ذكي لأدائك اليوم مع نصائح مخصصة</p>
        </div>
        <button onClick={load} className="rounded-xl border border-[#d6ece5] bg-white px-4 py-2 text-[13px] font-semibold text-[#475569] transition hover:bg-[#f0faf8] hover:text-[#1a5c4f]">
          تحديث ↻
        </button>
      </div>

      {/* Score + Priority Action */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Score Card */}
        <div className={`${CARD} flex flex-col items-center justify-center text-center`}>
          <ScoreRing score={s.score} />
          <p className="mt-4 text-[15px] font-semibold text-[#1e1b4b]">{c.summary}</p>
          <p className="mt-1 text-[12px] text-[#94a3b8]">
            {new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* Priority Action + AI Tips */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Priority Banner */}
          <div className={`flex items-center gap-4 rounded-2xl bg-gradient-to-l ${mood.gradient} p-5 text-white shadow-lg`}>
            <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-white/20 text-2xl">🎯</div>
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">الأولوية الحين</p>
              <p className="mt-1 text-[18px] font-bold">{c.priority_action}</p>
            </div>
          </div>

          {/* Tips */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {c.tips.slice(0, 4).map((tip, i) => (
              <TipCard key={i} tip={tip} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard icon="✅" label="المهام المنجزة" value={`${s.tasksCompleted}/${s.tasksTotal}`} sub={s.overdueTasks > 0 ? `${s.overdueTasks} متأخرة` : "لا متأخرات"} accent="#10b981" />
        <MetricCard icon="📞" label="عملاء تم التواصل" value={String(s.contacts)} sub="تواصل اليوم" accent="#3b82f6" />
        <MetricCard icon="📈" label="صفقات محرّكة" value={String(s.dealsAdvanced)} sub="تقدّمت اليوم" accent="#8b5cf6" />
        <MetricCard icon="⏱️" label="متوسط وقت الرد" value={s.avgResponseHours !== null ? `${s.avgResponseHours}h` : "—"} sub={s.avgResponseHours !== null && s.avgResponseHours <= 4 ? "سريع" : s.avgResponseHours !== null ? "يحتاج تحسين" : "لا بيانات"} accent="#f59e0b" />
      </div>

      {/* Bottom Row: Tasks + Stale */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Today's Tasks */}
        <div className={CARD}>
          <h3 className="mb-4 text-[16px] font-bold text-[#1e1b4b]">مهام اليوم</h3>
          {s.topCompletedTasks.length === 0 && s.missedTasks.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-[#94a3b8]">لا توجد مهام لليوم</p>
          ) : (
            <div>
              {s.topCompletedTasks.map((t, i) => <TaskItem key={`d${i}`} title={t.title} status="done" />)}
              {s.missedTasks.map((t, i) => <TaskItem key={`m${i}`} title={t.title} status="missed" />)}
            </div>
          )}
        </div>

        {/* Stale Deals */}
        <div className={CARD}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-[#1e1b4b]">صفقات راكدة</h3>
            {s.staleLeads > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">{s.staleLeads} صفقة</span>
            )}
          </div>
          {s.staleLeadNames.length === 0 ? (
            <div className="py-8 text-center">
              <span className="text-3xl">🎉</span>
              <p className="mt-2 text-[14px] font-medium text-[#10b981]">لا صفقات راكدة — ممتاز!</p>
            </div>
          ) : (
            s.staleLeadNames.map((sl, i) => <StaleItem key={i} name={sl.name} days={sl.daysSince} />)
          )}
        </div>
      </div>
    </div>
  );
}
