"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchBriefingData, type BriefingData, type BriefingTask, type StuckDeal } from "@/lib/dailyBriefing";

const BRIEFING_KEY = "mawrid_briefing_seen";
const PANEL_KEY = "mawrid_briefing_panel_collapsed";

function shouldShowBriefing(): boolean {
  const seen = localStorage.getItem(BRIEFING_KEY);
  if (!seen) return true;
  const seenDate = new Date(seen);
  const today = new Date();
  return seenDate.toDateString() !== today.toDateString();
}

function markBriefingSeen() {
  localStorage.setItem(BRIEFING_KEY, new Date().toISOString());
}

function arabicDate(d: Date) {
  return d.toLocaleDateString("ar-SA-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function timeAr(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" });
}

function taskDot(t: BriefingTask, overdue: boolean) {
  if (overdue) return "🔴";
  const d = t.due_at ? new Date(t.due_at) : null;
  if (!d) return "⚪";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday ? "🟡" : "⚪";
}

interface Suggestion {
  status: "loading" | "done" | "error" | "empty";
  action?: string;
  reason?: string;
}

/** In-panel AI next-action suggestion — fetched only when the rep asks for it, never in the background. */
function AISuggestButton({ deal, suggestion, onFetch }: { deal: StuckDeal; suggestion: Suggestion | undefined; onFetch: () => void }) {
  if (!suggestion) {
    return (
      <button
        onClick={onFetch}
        className="mt-1 flex items-center gap-1 rounded-full bg-[#f0faf8] px-2 py-0.5 text-[11px] font-semibold text-[#1a5c4f] transition hover:bg-[#e2f4ef]"
      >
        ✨ اقترح لي إجراء
      </button>
    );
  }
  if (suggestion.status === "loading") {
    return <p className="mt-1 text-[11px] text-gray-400">جارِ التفكير…</p>;
  }
  if (suggestion.status === "error") {
    return <p className="mt-1 text-[11px] text-red-400">تعذّر جلب الاقتراح</p>;
  }
  if (suggestion.status === "empty") {
    return <p className="mt-1 text-[11px] text-gray-400">لا يوجد نشاط كافٍ بعد لاقتراح إجراء</p>;
  }
  return (
    <p dir="auto" className="mt-1 rounded-lg bg-[#f0faf8] p-2 text-[12px] leading-relaxed text-[#1a5c4f]">
      ✨ {suggestion.action}
    </p>
  );
}

export default function DailyBriefing() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [data, setData] = useState<BriefingData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalLeaving, setModalLeaving] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [celebrate, setCelebrate] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data: userRes } = await supabase.auth.getUser();
      const name = (userRes.user?.user_metadata?.full_name as string) || (userRes.user?.email ?? "").split("@")[0] || "";
      const briefing = await fetchBriefingData();
      if (cancelled) return;
      setFirstName(name.split(" ")[0] || "");
      setData(briefing);
      if (shouldShowBriefing()) {
        setShowModal(true);
      } else {
        setCollapsed(localStorage.getItem(PANEL_KEY) !== "0");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    markBriefingSeen();
    setModalLeaving(true);
    setTimeout(() => {
      setShowModal(false);
      setModalLeaving(false);
      setCollapsed(false);
      localStorage.setItem(PANEL_KEY, "0");
    }, 400);
  }, []);

  const toggleCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    localStorage.setItem(PANEL_KEY, next ? "1" : "0");
  }, []);

  const completeTask = useCallback(async (task: BriefingTask) => {
    if (completing.has(task.id)) return;
    setCompleting((prev) => new Set(prev).add(task.id));
    const { error } = await supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", task.id);
    if (error) {
      console.error("[DailyBriefing] Failed to complete task", error);
      setCompleting((prev) => {
        const n = new Set(prev);
        n.delete(task.id);
        return n;
      });
      return;
    }
    setTimeout(() => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          todayTasks: prev.todayTasks.filter((t) => t.id !== task.id),
          overdueTasks: prev.overdueTasks.filter((t) => t.id !== task.id),
        };
      });
      setCompleting((prev) => {
        const n = new Set(prev);
        n.delete(task.id);
        return n;
      });
    }, 1000);
  }, [completing]);

  const fetchSuggestion = useCallback(async (deal: StuckDeal) => {
    setSuggestions((prev) => ({ ...prev, [deal.id]: { status: "loading" } }));
    try {
      const res = await fetch("/api/next-best-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: deal.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSuggestions((prev) => ({ ...prev, [deal.id]: { status: "error" } }));
        return;
      }
      if (!json.recommendation) {
        setSuggestions((prev) => ({ ...prev, [deal.id]: { status: "empty" } }));
        return;
      }
      setSuggestions((prev) => ({
        ...prev,
        [deal.id]: { status: "done", action: json.recommendation.action, reason: json.recommendation.reason },
      }));
    } catch (err) {
      console.error("[DailyBriefing] next-best-action fetch failed", err);
      setSuggestions((prev) => ({ ...prev, [deal.id]: { status: "error" } }));
    }
  }, []);

  const remainingCount = useMemo(() => {
    if (!data) return 0;
    return data.todayTasks.length + data.overdueTasks.length;
  }, [data]);

  useEffect(() => {
    if (!collapsed && data && remainingCount === 0 && data.stuckDeals.length === 0) {
      setCelebrate(true);
      const t = setTimeout(() => toggleCollapsed(true), 3000);
      return () => clearTimeout(t);
    }
    setCelebrate(false);
  }, [collapsed, data, remainingCount, toggleCollapsed]);

  if (!data) return null;

  const totalToday = data.todayTasks.length + data.overdueTasks.length;
  const hasOverdueBadge = data.overdueTasks.length > 0;
  const hasStuckBadge = data.stuckDeals.length > 0;
  // Priority queue: coldest deals surface first — that IS the prioritization.
  const priorityDeals = data.stuckDeals.slice(0, 5);

  return (
    <>
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          style={{ animation: "briefingBackdropIn 0.2s ease-out" }}
        >
          <div
            className="w-full max-w-[480px] rounded-2xl bg-white p-8 shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
            style={{
              animation: modalLeaving
                ? "briefingModalOut 0.4s ease-in forwards"
                : "briefingModalIn 0.3s ease-out",
            }}
          >
            <p dir="auto" className="text-[24px] font-extrabold text-[#1e1b4b]">
              🌅 صباح الخير، {firstName || "بك"}
            </p>
            <p className="mt-1 text-[13px] text-gray-400">{arabicDate(new Date())}</p>
            <div className="my-4 h-px bg-gray-100" />

            {totalToday > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  📋 مهامك اليوم ({totalToday})
                </p>
                <div className="flex flex-col gap-2">
                  {data.overdueTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-red-50 p-3">
                      <span dir="auto" className="text-[14px] font-medium text-[#1e1b4b]">
                        🔴 {t.title || "مهمة بدون عنوان"}
                      </span>
                      <span className="font-mono text-[13px] text-gray-400">{timeAr(t.due_at)}</span>
                    </div>
                  ))}
                  {data.todayTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-gray-25 p-3">
                      <span dir="auto" className="text-[14px] font-medium text-[#1e1b4b]">
                        {taskDot(t, false)} {t.title || "مهمة بدون عنوان"}
                      </span>
                      <span className="font-mono text-[13px] text-gray-400">{timeAr(t.due_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.stuckDeals.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-gray-400">
                  ⚠️ صفقات تحتاج تواصل ({data.stuckDeals.length})
                </p>
                <div className="flex flex-col gap-2">
                  {data.stuckDeals.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-25 p-3">
                      <span dir="auto" className="text-[14px] font-medium text-[#1e1b4b]">
                        {d.leadName || d.name || "صفقة"}
                      </span>
                      <span className="text-[13px] font-semibold text-amber-500">{d.daysSinceContact} أيام بدون رد</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalToday === 0 && data.stuckDeals.length === 0 && (
              <p className="py-4 text-center text-[14px] text-gray-400">لا يوجد ما يحتاج انتباهك الآن 🎉</p>
            )}

            <div className="my-4 h-px bg-gray-100" />
            <button
              onClick={dismiss}
              className="w-full rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] py-3 text-[16px] font-semibold text-white shadow-[0_4px_12px_rgba(26,92,79,0.25)] transition-all hover:scale-[1.01] hover:shadow-[0_6px_18px_rgba(26,92,79,0.32)]"
            >
              تم — ابدأ يومك 🚀
            </button>
          </div>
        </div>
      )}

      <div
        className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-l-2xl border-l border-gray-100 bg-white shadow-[-4px_0_20px_rgba(0,0,0,0.08)] transition-[width] duration-300 ease-in-out"
        style={{ width: collapsed ? 48 : 300, maxHeight: "80vh" }}
      >
        {collapsed ? (
          <button
            onClick={() => toggleCollapsed(false)}
            className="flex flex-col items-center gap-2 px-2 py-4 text-lg"
            aria-label="فتح دليلك اليومي"
            title="دليلك اليومي"
          >
            <span>🧭</span>
            {hasOverdueBadge ? (
              <span className="h-2 w-2 rounded-full bg-red-500" />
            ) : hasStuckBadge ? (
              <span className="h-2 w-2 rounded-full bg-amber-400" />
            ) : null}
          </button>
        ) : celebrate ? (
          <div className="p-5 text-center">
            <p dir="auto" className="text-[14px] font-semibold text-[#1e1b4b]">
              🎉 أنجزت كل مهامك اليوم!
            </p>
          </div>
        ) : (
          <div className="flex flex-col overflow-y-auto p-4">
            <div className="mb-2 flex items-center justify-between">
              <span dir="auto" className="text-[14px] font-bold text-[#1e1b4b]">
                🧭 دليلك اليومي
              </span>
              <button
                onClick={() => toggleCollapsed(true)}
                aria-label="طي اللوحة"
                className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-[#1a5c4f]"
              >
                ←
              </button>
            </div>
            <div className="h-px bg-gray-100" />

            {totalToday > 0 && (
              <div className="my-2 flex flex-col gap-1.5">
                {[...data.overdueTasks, ...data.todayTasks].slice(0, 6).map((t) => {
                  const done = completing.has(t.id);
                  const overdue = data.overdueTasks.some((x) => x.id === t.id);
                  return (
                    <div key={t.id} className={`flex items-center gap-2 py-1 transition-opacity ${done ? "opacity-40" : ""}`}>
                      <button
                        onClick={() => completeTask(t)}
                        aria-label="إتمام المهمة"
                        className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 transition-colors ${
                          done ? "border-[#1a5c4f] bg-[#1a5c4f]" : overdue ? "border-red-300 hover:border-[#1a5c4f]" : "border-gray-200 hover:border-[#1a5c4f]"
                        }`}
                      >
                        {done && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                      <span dir="auto" className={`min-w-0 flex-1 truncate text-[13px] text-[#334155] ${done ? "line-through" : ""}`}>
                        {taskDot(t, overdue)} {t.title || "مهمة"}
                      </span>
                      <span className="flex-none font-mono text-[11px] text-gray-400">{timeAr(t.due_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {priorityDeals.length > 0 && (
              <>
                <div className="h-px bg-gray-100" />
                <p dir="auto" className="mt-2 text-[13px] font-semibold text-amber-600">
                  🎯 أولوياتك — صفقات باردة
                </p>
                <div className="mt-1 flex flex-col gap-2.5">
                  {priorityDeals.map((d) => (
                    <div key={d.id} className="rounded-lg bg-gray-25 p-2">
                      <button
                        onClick={() => router.push(`/dashboard/deals/${d.id}/investigation`)}
                        className="block w-full text-left"
                      >
                        <p dir="auto" className="truncate text-[13px] font-semibold text-[#1e1b4b]">
                          {d.leadName || d.name || "صفقة"}
                        </p>
                        <p className="text-[11px] text-gray-500">{d.daysSinceContact} أيام بدون تواصل</p>
                      </button>
                      <AISuggestButton deal={d} suggestion={suggestions[d.id]} onFetch={() => fetchSuggestion(d)} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {totalToday === 0 && priorityDeals.length === 0 && (
              <p className="py-6 text-center text-[13px] text-gray-400">🎉 كل شيء تحت السيطرة</p>
            )}

            <div className="mt-3 h-px bg-gray-100" />
            <button
              onClick={() => router.push("/dashboard/tasks")}
              className="mt-3 w-full rounded-full border border-[#1a5c4f]/30 py-2 text-[13px] font-semibold text-[#1a5c4f] transition hover:bg-[#f0faf8]"
            >
              فتح المهام الكاملة
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes briefingBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes briefingModalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes briefingModalOut {
          from { opacity: 1; transform: scale(1) translateX(0); }
          to { opacity: 0; transform: scale(0.9) translateX(60px); }
        }
      `}</style>
    </>
  );
}
