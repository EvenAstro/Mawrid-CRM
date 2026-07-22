"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCopilot } from "@/components/copilot/CopilotProvider";
import { fetchBriefingData, type BriefingData, type BriefingTask, type StuckDeal } from "@/lib/dailyBriefing";

const BRIEFING_KEY = "mawrid_briefing_seen";
const PANEL_KEY = "mawrid_briefing_panel_collapsed";
const EMPTY_BRIEFING: BriefingData = { todayTasks: [], overdueTasks: [], stuckDeals: [] };

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

/** "صباح الخير" before 10am, "أهلاً" until noon, "مساء الخير" after — makes the modal feel time-aware. */
function greetingForHour(h: number): string {
  if (h < 10) return "صباح الخير";
  if (h < 12) return "أهلاً";
  return "مساء الخير";
}
function greetingEmoji(h: number): string {
  if (h < 10) return "☀️";
  if (h < 12) return "🌤";
  return "🌙";
}

/** One-line local summary of the day — no API call, pure data → text. */
function daySummary(overdue: number, stuck: number, today: number): string {
  if (overdue > 0) return `عندك ${overdue} ${overdue === 1 ? "مهمة متأخرة تحتاج" : "مهام متأخرة تحتاج"} اهتمامك أولاً`;
  if (stuck > 0) return `عندك ${stuck} ${stuck === 1 ? "صفقة لم تتواصل معها" : "صفقات لم تتواصل معها"} من أكثر من أسبوع`;
  if (today > 0) return `يوم منظم — عندك ${today} ${today === 1 ? "مهمة مجدولة" : "مهام مجدولة"} اليوم`;
  return "🎉 ما عندك أي مهام أو صفقات عالقة — يوم خفيف!";
}

interface Suggestion {
  status: "loading" | "done" | "error" | "empty";
  action?: string;
  reason?: string;
}

/** In-panel AI next-action suggestion — fetched only when the rep asks for it, never in the background. */
function AISuggestButton({ suggestion, onFetch }: { suggestion: Suggestion | undefined; onFetch: () => void }) {
  if (!suggestion) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onFetch(); }}
        className="mt-2 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1a5c4f] shadow-sm ring-1 ring-inset ring-amber-200 transition hover:bg-[#f0faf8]"
      >
        ✨ اقترح لي إجراء
      </button>
    );
  }
  if (suggestion.status === "loading") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-300" /> جارِ التفكير…
      </p>
    );
  }
  if (suggestion.status === "error") {
    return <p className="mt-2 text-[11px] text-red-400">تعذّر جلب الاقتراح</p>;
  }
  if (suggestion.status === "empty") {
    return <p className="mt-2 text-[11px] text-gray-400">لا يوجد نشاط كافٍ بعد لاقتراح إجراء</p>;
  }
  return (
    <p dir="auto" className="mt-2 rounded-xl bg-white p-2.5 text-[12px] leading-relaxed text-[#1a5c4f] shadow-sm ring-1 ring-inset ring-[#1a5c4f]/10">
      ✨ {suggestion.action}
    </p>
  );
}

function SectionLabel({ icon, tone, children }: { icon: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center gap-2 first:mt-0">
      <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] ${tone}`}>{icon}</span>
      <span dir="auto" className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{children}</span>
    </div>
  );
}

export default function DailyBriefing() {
  const router = useRouter();
  const copilot = useCopilot();
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
      let briefing: BriefingData;
      try {
        briefing = await fetchBriefingData();
      } catch (err) {
        console.error("[DailyBriefing] fetchBriefingData failed", err);
        briefing = EMPTY_BRIEFING;
      }
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
    }, 800);
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

  const askCopilotAboutDeal = useCallback((e: React.MouseEvent, deal: StuckDeal) => {
    e.stopPropagation();
    const name = deal.leadName || deal.name || "هذه الصفقة";
    copilot.setOpen(true);
    copilot.send(`وش أنصح أسوي مع صفقة ${name}؟`);
  }, [copilot]);

  const remainingCount = useMemo(() => {
    if (!data) return 0;
    return data.todayTasks.length + data.overdueTasks.length;
  }, [data]);

  const allClear = !!data && remainingCount === 0 && data.stuckDeals.length === 0;

  useEffect(() => {
    if (!collapsed && allClear) {
      setCelebrate(true);
      const t = setTimeout(() => toggleCollapsed(true), 3000);
      return () => clearTimeout(t);
    }
    setCelebrate(false);
  }, [collapsed, allClear, toggleCollapsed]);

  if (!data) return null;

  const totalToday = data.todayTasks.length + data.overdueTasks.length;
  const totalPending = totalToday + data.stuckDeals.length;
  const hasOverdue = data.overdueTasks.length > 0;
  // Priority queue: coldest deals surface first — that IS the prioritization.
  const priorityDeals = data.stuckDeals.slice(0, 5);
  const pulseColor = hasOverdue ? "#ef4444" : allClear ? "#10b981" : "#f59e0b";
  const now = new Date();
  const summaryLine = daySummary(data.overdueTasks.length, data.stuckDeals.length, data.todayTasks.length);

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
              {greetingEmoji(now.getHours())} {greetingForHour(now.getHours())}، {firstName || "بك"}
            </p>
            <p className="mt-1 text-[13px] text-gray-400">{arabicDate(now)}</p>
            <div className="mt-4 rounded-xl bg-[#f0faf8] px-4 py-3">
              <p dir="auto" className="text-[14px] font-semibold text-[#1a5c4f]">{summaryLine}</p>
            </div>

            {totalToday > 0 && (
              <div className="mt-5">
                <SectionLabel icon="📋" tone="bg-[#e8f4f1] text-[#1a5c4f]">مهامك اليوم ({totalToday})</SectionLabel>
                <div className="flex flex-col gap-2">
                  {data.overdueTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2.5 ring-1 ring-inset ring-red-100">
                      <span dir="auto" className="truncate text-[14px] font-medium text-[#1e1b4b]">
                        🔴 {t.title || "مهمة بدون عنوان"}
                      </span>
                      <span className="flex-none font-mono text-[12px] font-semibold text-red-400">متأخرة</span>
                    </div>
                  ))}
                  {data.todayTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl bg-gray-25 px-3 py-2.5 ring-1 ring-inset ring-gray-100">
                      <span dir="auto" className="truncate text-[14px] font-medium text-[#1e1b4b]">
                        🟡 {t.title || "مهمة بدون عنوان"}
                      </span>
                      <span className="flex-none font-mono text-[13px] text-gray-400">{timeAr(t.due_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.stuckDeals.length > 0 && (
              <div className="mt-5">
                <SectionLabel icon="⚠️" tone="bg-amber-50 text-amber-600">صفقات تحتاج تواصل ({data.stuckDeals.length})</SectionLabel>
                <div className="flex flex-col gap-2">
                  {data.stuckDeals.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-xl bg-amber-50/60 px-3 py-2.5 ring-1 ring-inset ring-amber-100">
                      <span dir="auto" className="truncate text-[14px] font-medium text-[#1e1b4b]">
                        {d.leadName || d.name || "صفقة"}
                      </span>
                      <span className="flex-none text-[12px] font-semibold text-amber-600">{d.daysSinceContact} أيام بدون رد</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalToday === 0 && data.stuckDeals.length === 0 && (
              <p className="py-6 text-center text-[14px] text-gray-400">لا يوجد ما يحتاج انتباهك الآن 🎉</p>
            )}

            <button
              onClick={dismiss}
              className="mt-6 w-full rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] py-3 text-[16px] font-semibold text-white shadow-[0_4px_12px_rgba(26,92,79,0.25)] transition-all hover:scale-[1.01] hover:shadow-[0_6px_18px_rgba(26,92,79,0.32)]"
            >
              تم — ابدأ يومك 🚀
            </button>
          </div>
        </div>
      )}

      <div
        className="fixed right-0 z-40 flex flex-col overflow-hidden rounded-l-2xl border border-gray-100 bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out"
        style={{ width: collapsed ? 56 : 320, top: 96, bottom: collapsed ? "auto" : 110 }}
      >
        {collapsed ? (
          <button
            onClick={() => toggleCollapsed(false)}
            className="relative flex flex-col items-center gap-1.5 px-2 py-4 transition hover:bg-gray-25"
            aria-label="فتح دليلك اليومي"
            title="دليلك اليومي"
          >
            <span className="text-2xl">🧭</span>
            <span dir="auto" className="text-[10px] font-semibold text-gray-400">مساعدك</span>
            {totalPending > 0 && (
              <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative">{totalPending}</span>
              </span>
            )}
            {totalPending === 0 && (
              <span className="absolute -top-1 -left-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </button>
        ) : celebrate ? (
          <div className="flex flex-col items-center justify-center gap-1 bg-[#f0fdf4] px-5 py-8 text-center transition-colors">
            <span className="text-3xl">🎉</span>
            <p dir="auto" className="text-[14px] font-semibold text-[#166534]">أنجزت كل شيء!</p>
          </div>
        ) : (
          <div className="flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-l from-[#f0faf8] to-white px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: pulseColor }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: pulseColor }} />
                </span>
                <span dir="auto" className="text-[13px] font-bold text-[#1a5c4f]">مساعد اليوم</span>
                {totalPending > 0 && (
                  <span className="rounded-full bg-[#1a5c4f]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#1a5c4f]">{totalPending}</span>
                )}
              </div>
              <button
                onClick={() => toggleCollapsed(true)}
                aria-label="طي اللوحة"
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white hover:text-[#1a5c4f]"
              >
                →
              </button>
            </div>

            <div className="flex-1 px-4 pb-3">
              {totalToday > 0 && (
                <>
                  <SectionLabel icon="📋" tone="bg-[#e8f4f1] text-[#1a5c4f]">مهامك</SectionLabel>
                  <div className="flex flex-col gap-1.5">
                    {[...data.overdueTasks, ...data.todayTasks].slice(0, 6).map((t) => {
                      const done = completing.has(t.id);
                      const overdue = data.overdueTasks.some((x) => x.id === t.id);
                      return (
                        <div
                          key={t.id}
                          className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all ${
                            overdue ? "bg-red-50 ring-1 ring-inset ring-red-100" : "hover:bg-gray-25"
                          } ${done ? "opacity-40" : ""}`}
                        >
                          <button
                            onClick={() => completeTask(t)}
                            aria-label="إتمام المهمة"
                            className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2 transition-colors ${
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
                            {t.title || "مهمة"}
                          </span>
                          <span className={`flex-none font-mono text-[11px] ${overdue ? "font-semibold text-red-500" : "text-gray-400"}`}>
                            {overdue ? "متأخرة" : timeAr(t.due_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {priorityDeals.length > 0 && (
                <>
                  <SectionLabel icon="🎯" tone="bg-amber-50 text-amber-600">أولوياتك — صفقات باردة</SectionLabel>
                  <div className="flex flex-col gap-2">
                    {priorityDeals.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => router.push(`/dashboard/deals/${d.id}/investigation`)}
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer rounded-xl bg-amber-50/60 p-2.5 ring-1 ring-inset ring-amber-100 transition hover:bg-amber-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p dir="auto" className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#1e1b4b]">
                            {d.leadName || d.name || "صفقة"}
                          </p>
                          <span className="flex-none text-[11px] font-bold text-amber-600">{d.daysSinceContact} يوم</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            onClick={(e) => askCopilotAboutDeal(e, d)}
                            className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1a5c4f] shadow-sm ring-1 ring-inset ring-[#1a5c4f]/15 transition hover:bg-[#f0faf8]"
                          >
                            💬 اسأل الكوبايلوت
                          </button>
                        </div>
                        <AISuggestButton suggestion={suggestions[d.id]} onFetch={() => fetchSuggestion(d)} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {totalToday === 0 && priorityDeals.length === 0 && (
                <p className="py-8 text-center text-[13px] text-gray-400">🎉 كل شيء تحت السيطرة</p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-25/60 px-4 py-3">
              <button
                onClick={() => copilot.setOpen(true)}
                className="w-full rounded-full bg-[linear-gradient(135deg,#1a5c4f_0%,#2d8570_100%)] py-2 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                💬 فتح الكوبايلوت
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => router.push("/dashboard/tasks")}
                  className="w-full rounded-full border border-[#1a5c4f]/25 bg-white py-2 text-[12px] font-semibold text-[#1a5c4f] transition hover:bg-[#f0faf8]"
                >
                  عرض كل المهام
                </button>
                <button
                  onClick={() => router.push("/dashboard/deals?filter=active")}
                  className="w-full rounded-full border border-[#1a5c4f]/25 bg-white py-2 text-[12px] font-semibold text-[#1a5c4f] transition hover:bg-[#f0faf8]"
                >
                  عرض كل الصفقات
                </button>
              </div>
              {process.env.NODE_ENV !== "production" && (
                <button
                  onClick={() => {
                    localStorage.removeItem(BRIEFING_KEY);
                    location.reload();
                  }}
                  className="w-full rounded-full border border-dashed border-gray-300 py-1.5 text-[11px] font-medium text-gray-400 transition hover:border-gray-400 hover:text-gray-500"
                >
                  🔄 إعادة تعيين (dev)
                </button>
              )}
            </div>
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
