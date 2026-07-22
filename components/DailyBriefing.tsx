"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCopilot } from "@/components/copilot/CopilotProvider";
import Button from "@/components/ui/Button";
import { fetchBriefingData, type BriefingData, type BriefingTask, type StuckDeal } from "@/lib/dailyBriefing";

const BRIEFING_KEY = "mawrid_briefing_seen";
const PANEL_KEY = "mawrid_briefing_panel_collapsed";
const POS_KEY = "mawrid_briefing_panel_pos";
const EMPTY_BRIEFING: BriefingData = { todayTasks: [], overdueTasks: [], stuckDeals: [] };

interface Pos {
  top: number;
  left: number;
}

function clampPos(p: Pos, width: number, height: number): Pos {
  const maxLeft = Math.max(8, window.innerWidth - width - 8);
  const maxTop = Math.max(8, window.innerHeight - height - 8);
  return { top: Math.min(Math.max(8, p.top), maxTop), left: Math.min(Math.max(8, p.left), maxLeft) };
}

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
  return "ما عندك أي مهام أو صفقات عالقة — يوم خفيف!";
}

/* ── Minimal line-icon set, matching the app's existing navIcons stroke style ── */
type IconProps = { className?: string };
function Icon({ children, className = "h-4 w-4" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}
const CompassIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="m14.5 9.5-2 5-5 2 2-5 5-2Z" />
  </Icon>
);
const ChecklistIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="m8.5 12 2.5 2.5L16 9" />
  </Icon>
);
const TargetIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.2" />
  </Icon>
);
const ChatIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M4 5.5h16v11H9.5L5 20v-3.5H4v-11Z" />
  </Icon>
);
const SparkleIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" />
  </Icon>
);
const GripIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    {[7, 12, 17].flatMap((cy) => [9, 15].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.4" />))}
  </svg>
);
const ChevronIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);

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
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border-light bg-white px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:border-primary/30 hover:bg-mint"
      >
        <SparkleIcon className="h-3 w-3" /> اقترح لي إجراء
      </button>
    );
  }
  if (suggestion.status === "loading") {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-300" /> جارِ التفكير…
      </p>
    );
  }
  if (suggestion.status === "error") {
    return <p className="mt-2 text-[11px] text-danger">تعذّر جلب الاقتراح</p>;
  }
  if (suggestion.status === "empty") {
    return <p className="mt-2 text-[11px] text-muted">لا يوجد نشاط كافٍ بعد لاقتراح إجراء</p>;
  }
  return (
    <p dir="auto" className="mt-2 rounded-lg border border-border-light bg-mint p-2.5 text-[12px] leading-relaxed text-primary">
      {suggestion.action}
    </p>
  );
}

function SectionLabel({ icon, tone, children, count }: { icon: React.ReactNode; tone: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-2.5 mt-4 flex items-center gap-2 first:mt-0">
      <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <span dir="auto" className="text-[11px] font-bold uppercase tracking-wide text-muted">{children}</span>
      {count != null && count > 0 && <span className="text-[11px] font-bold text-muted">{count}</span>}
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
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number; moved: boolean } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(POS_KEY);
    if (saved) {
      try {
        setPos(JSON.parse(saved));
        return;
      } catch {
        /* fall through to default */
      }
    }
    setPos({ top: 96, left: window.innerWidth - 320 - 16 });
  }, []);

  const beginDrag = useCallback((e: React.PointerEvent) => {
    if (!pos) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: pos.top, startLeft: pos.left, moved: false };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
      if (!d.moved) return;
      const w = panelRef.current?.offsetWidth ?? 320;
      const h = panelRef.current?.offsetHeight ?? 300;
      setPos(clampPos({ top: d.startTop + dy, left: d.startLeft + dx }, w, h));
    }
    function onUp() {
      setDragging(false);
      setPos((p) => {
        if (p) localStorage.setItem(POS_KEY, JSON.stringify(p));
        return p;
      });
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  const planMyDay = useCallback(() => {
    copilot.setOpen(true);
    copilot.send(
      "خطط لي يومي: رتب أولوياتي بناءً على مهامي الحالية والصفقات العالقة وآخر نشاط لكل صفقة، وأعطني خطوات عملية مرتبة أبدأ فيها الآن.",
    );
  }, [copilot]);

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

  if (!data || !pos) return null;

  const totalToday = data.todayTasks.length + data.overdueTasks.length;
  const totalPending = totalToday + data.stuckDeals.length;
  const hasOverdue = data.overdueTasks.length > 0;
  // Priority queue: coldest deals surface first — that IS the prioritization.
  const priorityDeals = data.stuckDeals.slice(0, 5);
  const statusColor = hasOverdue ? "#ef4444" : allClear ? "#10b981" : "#f59e0b";
  const now = new Date();
  const summaryLine = daySummary(data.overdueTasks.length, data.stuckDeals.length, data.todayTasks.length);

  return (
    <>
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          style={{ animation: "briefingBackdropIn 0.2s ease-out" }}
        >
          <div
            className="w-full max-w-[460px] rounded-2xl border border-border-light bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
            style={{ animation: modalLeaving ? "briefingModalOut 0.4s ease-in forwards" : "briefingModalIn 0.3s ease-out" }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-mint text-lg">
                {greetingEmoji(now.getHours())}
              </span>
              <div className="min-w-0">
                <p dir="auto" className="truncate text-[19px] font-extrabold text-ink">{greetingForHour(now.getHours())}، {firstName || "بك"}</p>
                <p className="text-[13px] text-muted">{arabicDate(now)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border-light bg-mint/60 px-4 py-3">
              <p dir="auto" className="text-[14px] font-semibold text-primary">{summaryLine}</p>
            </div>

            {totalToday > 0 && (
              <div className="mt-4">
                <SectionLabel icon={<ChecklistIcon className="h-3.5 w-3.5" />} tone="bg-mint text-primary">مهامك اليوم</SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {data.overdueTasks.map((t) => (
                    <div key={t.id} className="relative overflow-hidden rounded-lg border border-border-light bg-white py-2.5 pl-3 pr-3">
                      <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-full bg-danger" />
                      <div className="flex items-center justify-between gap-2 pl-2">
                        <span dir="auto" className="truncate text-[14px] font-medium text-ink">{t.title || "مهمة بدون عنوان"}</span>
                        <span className="flex-none text-[12px] font-semibold text-danger">متأخرة</span>
                      </div>
                    </div>
                  ))}
                  {data.todayTasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border-light bg-white px-3 py-2.5">
                      <span dir="auto" className="truncate text-[14px] font-medium text-ink">{t.title || "مهمة بدون عنوان"}</span>
                      <span className="flex-none font-mono text-[13px] text-muted">{timeAr(t.due_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.stuckDeals.length > 0 && (
              <div className="mt-4">
                <SectionLabel icon={<TargetIcon className="h-3.5 w-3.5" />} tone="bg-amber-50 text-warning">صفقات تحتاج تواصل</SectionLabel>
                <div className="flex flex-col gap-1.5">
                  {data.stuckDeals.slice(0, 5).map((d) => (
                    <div key={d.id} className="relative overflow-hidden rounded-lg border border-border-light bg-white py-2.5 pl-3 pr-3">
                      <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-full bg-warning" />
                      <div className="flex items-center justify-between gap-2 pl-2">
                        <span dir="auto" className="truncate text-[14px] font-medium text-ink">{d.leadName || d.name || "صفقة"}</span>
                        <span className="flex-none rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-warning">{d.daysSinceContact} يوم</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {totalToday === 0 && data.stuckDeals.length === 0 && (
              <p className="py-6 text-center text-[14px] text-muted">لا يوجد ما يحتاج انتباهك الآن</p>
            )}

            <Button onClick={dismiss} fullWidth className="mt-5">تم — ابدأ يومك</Button>
          </div>
        </div>
      )}

      <div
        ref={panelRef}
        className={`fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-[0_4px_24px_rgba(15,23,20,0.1)] ${dragging ? "" : "transition-[width] duration-300 ease-in-out"}`}
        style={{ width: collapsed ? 52 : 316, top: pos.top, left: pos.left, maxHeight: collapsed ? undefined : "min(72vh, 560px)" }}
      >
        {collapsed ? (
          <button
            onPointerDown={beginDrag}
            onClick={() => {
              if (dragRef.current?.moved) return; // suppress the click that follows a drag
              toggleCollapsed(false);
            }}
            className="relative flex cursor-grab flex-col items-center gap-2 px-2 py-4 transition hover:bg-gray-25 active:cursor-grabbing"
            aria-label="فتح المساعد اليومي — اسحب لتحريكه"
            title="المساعد اليومي (اسحب لتحريكه)"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint text-primary">
              <CompassIcon className="h-4 w-4" />
            </span>
            {totalPending > 0 ? (
              <span className="absolute -top-1 -left-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {totalPending}
              </span>
            ) : (
              <span className="absolute -top-0.5 -left-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-white" />
            )}
          </button>
        ) : celebrate ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-success">
              <ChecklistIcon className="h-5 w-5" />
            </span>
            <p dir="auto" className="text-[14px] font-semibold text-ink">أنجزت كل شيء اليوم</p>
          </div>
        ) : (
          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border-light px-2 py-2.5">
              <button
                onPointerDown={beginDrag}
                aria-label="اسحب لتحريك اللوحة"
                title="اسحب لتحريك اللوحة"
                className="cursor-grab rounded-lg px-1.5 py-1.5 text-gray-300 transition hover:bg-gray-25 hover:text-muted active:cursor-grabbing"
              >
                <GripIcon className="h-4 w-4" />
              </button>
              <div className="flex flex-1 items-center gap-2 px-1">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-mint text-primary">
                  <CompassIcon className="h-3.5 w-3.5" />
                </span>
                <span dir="auto" className="text-[13px] font-bold text-ink">المساعد اليومي</span>
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: statusColor }} />
                {totalPending > 0 && (
                  <span className="rounded-full bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-ink-secondary">{totalPending}</span>
                )}
              </div>
              <button
                onClick={() => toggleCollapsed(true)}
                aria-label="طي اللوحة"
                className="rounded-lg p-1.5 text-muted transition hover:bg-gray-25 hover:text-primary"
              >
                <ChevronIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3.5 pb-3">
              {totalToday > 0 && (
                <>
                  <SectionLabel icon={<ChecklistIcon className="h-3.5 w-3.5" />} tone="bg-mint text-primary">مهامك</SectionLabel>
                  <div className="flex flex-col gap-1.5">
                    {[...data.overdueTasks, ...data.todayTasks].slice(0, 6).map((t) => {
                      const done = completing.has(t.id);
                      const overdue = data.overdueTasks.some((x) => x.id === t.id);
                      return (
                        <div
                          key={t.id}
                          className={`relative flex items-center gap-2.5 overflow-hidden rounded-lg border border-border-light bg-white px-2.5 py-2 transition-opacity ${done ? "opacity-40" : ""}`}
                        >
                          {overdue && <span className="absolute bottom-1 left-0 top-1 w-1 rounded-full bg-danger" />}
                          <button
                            onClick={() => completeTask(t)}
                            aria-label="إتمام المهمة"
                            className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2 transition-colors ${
                              done ? "border-primary bg-primary" : overdue ? "ml-1 border-red-200 hover:border-primary" : "border-gray-200 hover:border-primary"
                            }`}
                          >
                            {done && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                          <span dir="auto" className={`min-w-0 flex-1 truncate text-[13px] text-ink-secondary ${done ? "line-through" : ""}`}>
                            {t.title || "مهمة"}
                          </span>
                          <span className={`flex-none font-mono text-[11px] ${overdue ? "font-semibold text-danger" : "text-muted"}`}>
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
                  <SectionLabel icon={<TargetIcon className="h-3.5 w-3.5" />} tone="bg-amber-50 text-warning">أولوياتك — صفقات باردة</SectionLabel>
                  <div className="flex flex-col gap-2">
                    {priorityDeals.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => router.push(`/dashboard/deals/${d.id}/investigation`)}
                        role="button"
                        tabIndex={0}
                        className="relative cursor-pointer overflow-hidden rounded-lg border border-border-light bg-white p-2.5 pl-3.5 transition hover:border-warning/30 hover:shadow-sm"
                      >
                        <span className="absolute bottom-1.5 left-0 top-1.5 w-1 rounded-full bg-warning" />
                        <div className="flex items-center justify-between gap-2">
                          <p dir="auto" className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                            {d.leadName || d.name || "صفقة"}
                          </p>
                          <span className="flex-none rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-warning">{d.daysSinceContact} يوم</span>
                        </div>
                        <div className="mt-1.5">
                          <button
                            onClick={(e) => askCopilotAboutDeal(e, d)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border-light bg-white px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:border-primary/30 hover:bg-mint"
                          >
                            <ChatIcon className="h-3 w-3" /> اسأل الكوبايلوت
                          </button>
                        </div>
                        <AISuggestButton suggestion={suggestions[d.id]} onFetch={() => fetchSuggestion(d)} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {totalToday === 0 && priorityDeals.length === 0 && (
                <p className="py-8 text-center text-[13px] text-muted">كل شيء تحت السيطرة</p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-border-light px-3.5 py-3">
              <Button onClick={planMyDay} size="sm" fullWidth className="gap-1.5">
                <SparkleIcon className="h-3.5 w-3.5" /> خطط لي يومي
              </Button>
              <Button onClick={() => copilot.setOpen(true)} variant="secondary" size="sm" fullWidth className="gap-1.5">
                <ChatIcon className="h-3.5 w-3.5" /> فتح الكوبايلوت
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => router.push("/dashboard/tasks")} variant="ghost" size="sm" className="border border-border-light">
                  كل المهام
                </Button>
                <Button onClick={() => router.push("/dashboard/deals?filter=active")} variant="ghost" size="sm" className="border border-border-light">
                  كل الصفقات
                </Button>
              </div>
              {process.env.NODE_ENV !== "production" && (
                <button
                  onClick={() => {
                    localStorage.removeItem(BRIEFING_KEY);
                    location.reload();
                  }}
                  className="w-full rounded-lg border border-dashed border-gray-200 py-1.5 text-[11px] font-medium text-muted transition hover:border-gray-300"
                >
                  إعادة تعيين (dev)
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
