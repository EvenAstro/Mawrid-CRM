"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchCurrentProfile } from "@/lib/profiles";
import { profileName } from "@/lib/format";
import { useCopilot } from "@/components/copilot/CopilotProvider";
import ChatThread from "@/components/copilot/ChatThread";
import Composer from "@/components/copilot/Composer";
import {
  AlertIcon,
  ClockIcon,
  RobotIcon,
  TrophyIcon,
  XIcon,
} from "@/components/icons";

/**
 * المشرف — one assistant instead of three.
 *
 * This merges what used to be two separate floating surfaces: the Copilot,
 * which could answer questions but never volunteered anything, and the
 * SupervisorBot, which raised alerts but could not be replied to. Splitting
 * them meant a rep saw "you have 3 overdue tasks" and had nowhere to ask
 * "which ones?" — the two halves of the same conversation lived in different
 * widgets.
 *
 * Now: alerts and chat are two tabs on one panel, sharing one account context.
 * The panel opens on the alerts when something needs attention, and on the
 * chat when nothing does — because the first thing it should say is whichever
 * is actually true right now.
 */

interface Directive {
  id: string;
  type: "urgent" | "warning" | "remind" | "praise";
  message: string;
  action?: string;
  actionHref?: string;
}

interface CoachPayload {
  firstName?: string;
  directives: Directive[];
  stats?: {
    completedToday: number;
    pendingToday: number;
    overdueCount: number;
  };
}

const TONE: Record<
  Directive["type"],
  { rail: string; fg: string; bg: string; Icon: typeof AlertIcon; label: string }
> = {
  urgent: {
    rail: "border-s-[var(--status-danger-fg)]",
    fg: "text-[color:var(--status-danger-fg)]",
    bg: "bg-[var(--status-danger-bg)]",
    Icon: AlertIcon,
    label: "عاجل",
  },
  warning: {
    rail: "border-s-[var(--status-warning-fg)]",
    fg: "text-[color:var(--status-warning-fg)]",
    bg: "bg-[var(--status-warning-bg)]",
    Icon: AlertIcon,
    label: "انتبه",
  },
  remind: {
    rail: "border-s-[var(--content-accent)]",
    fg: "text-[color:var(--content-accent)]",
    bg: "bg-[var(--surface-accent-subtle)]",
    Icon: ClockIcon,
    label: "تذكير",
  },
  praise: {
    rail: "border-s-[var(--status-success-fg)]",
    fg: "text-[color:var(--status-success-fg)]",
    bg: "bg-[var(--status-success-bg)]",
    Icon: TrophyIcon,
    label: "أحسنت",
  },
};

export default function Supervisor() {
  const router = useRouter();
  const { open, setOpen, send, stats } = useCopilot();
  const [tab, setTab] = useState<"alerts" | "chat">("alerts");
  const [data, setData] = useState<CoachPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCurrentProfile()
      .then((p) => {
        if (!alive || !p) return;
        // First name only. "يا هلا عماد" is how a colleague opens; the full
        // legal name reads like a bank.
        setMe(p.first_name || profileName(p).split(" ")[0] || null);
      })
      .catch((err) => console.error("[supervisor] profile failed", err));
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/rep-coach", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as CoachPayload);
    } catch (err) {
      console.error("[supervisor] load failed", err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const directives = data?.directives ?? [];
  const urgent = directives.filter((d) => d.type === "urgent" || d.type === "warning").length;

  // Open on whichever half is actually true right now.
  useEffect(() => {
    if (open) setTab(urgent > 0 ? "alerts" : "chat");
  }, [open, urgent]);

  /** Asking about an alert should carry the alert with it, not start blank. */
  function askAbout(d: Directive) {
    setTab("chat");
    send(`بخصوص هذا التنبيه: «${d.message}» — وش أسوي بالضبط؟ اعطني خطوات محددة.`);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={urgent > 0 ? `افتح المشرف — ${urgent} تنبيه يحتاج انتباهك` : "افتح المشرف"}
          title="المشرف"
          className="fixed left-0 top-[184px] z-30 hidden w-[52px] flex-col items-center gap-1.5 rounded-e-[var(--radius-lg)] border border-s-0 border-[var(--border-subtle)] bg-[var(--surface-accent-subtle)] py-3.5 transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-active)] md:flex"
        >
          <span className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-raised)] text-[color:var(--content-accent)] e-1">
            <RobotIcon className="h-4.5 w-4.5" />
          </span>
          <span className="t-micro font-bold text-[color:var(--content-accent)]">المشرف</span>
          {urgent > 0 ? (
            <span className="t-micro absolute right-1 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--status-danger-fg)] px-1 font-bold tabular-nums text-white ring-2 ring-[var(--surface-accent-subtle)]">
              {urgent}
            </span>
          ) : (
            <span className="absolute right-2 top-2.5 h-2.5 w-2.5 rounded-full bg-[var(--status-success-fg)] ring-2 ring-[var(--surface-accent-subtle)]" />
          )}
        </button>
      )}

      {open && (
        <aside
          role="dialog"
          aria-label="المشرف"
          style={{ left: "calc(var(--briefing-rail-width, 52px) + 12px)" }}
          className="fixed top-20 z-[55] flex h-[min(620px,calc(100vh-7rem))] w-[min(400px,calc(100vw-3rem))] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-raised)] e-overlay"
        >
          <header className="flex items-center gap-3 bg-[var(--surface-inverse)] px-4 py-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-sm)] bg-white/[0.08] text-[color:var(--content-inverse-accent)]">
              <RobotIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <h2 className="t-title-3 truncate text-[color:var(--content-inverse-primary)]">
                {me ? `يا هلا ${me}` : "المشرف"}
              </h2>
              <span className="t-micro block text-[color:var(--content-inverse-tertiary)]">
                {stats
                  ? `${stats.activeDeals} صفقة نشطة · ${stats.totalLeads} عميل`
                  : "مطّلع على حسابك"}
              </span>
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="flex-none rounded-[var(--radius-xs)] p-1.5 text-[color:var(--content-inverse-tertiary)] transition-colors hover:bg-white/10 hover:text-[color:var(--content-inverse-primary)]"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </header>

          <div role="tablist" className="flex border-b border-[var(--border-subtle)]">
            {(["alerts", "chat"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`t-body-sm relative flex-1 py-2.5 font-semibold transition-colors duration-[var(--motion-fast)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:content-[''] ${
                  tab === t
                    ? "text-[color:var(--content-accent)] after:bg-[var(--content-accent)]"
                    : "text-[color:var(--content-tertiary)] after:bg-transparent hover:text-[color:var(--content-secondary)]"
                }`}
              >
                {t === "alerts" ? `تنبيهاتك${urgent > 0 ? ` (${urgent})` : ""}` : "اسأل المشرف"}
              </button>
            ))}
          </div>

          {tab === "alerts" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="skeleton-shimmer block h-16 rounded-[var(--radius-sm)]" />
                  ))}
                </div>
              ) : failed ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="t-body-sm text-[color:var(--content-tertiary)]">تعذّر تحميل التنبيهات</p>
                  <button
                    onClick={() => { setLoading(true); load(); }}
                    className="t-caption rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-1.5 font-semibold text-[color:var(--content-secondary)] hover:bg-[var(--surface-hover)]"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : directives.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <TrophyIcon className="h-8 w-8 text-[color:var(--status-success-fg)]" />
                  <p className="t-body-sm font-semibold text-[color:var(--content-primary)]">ما فيه شيء عاجل</p>
                  <p className="t-caption text-[color:var(--content-tertiary)]">
                    كل شيء تحت السيطرة — اسألني لو تبي تراجع شيئاً.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {directives.map((d) => {
                    const tone = TONE[d.type] ?? TONE.remind;
                    return (
                      <div
                        key={d.id}
                        className={`rounded-[var(--radius-sm)] border-s-2 p-3 ${tone.rail} ${tone.bg}`}
                      >
                        <p className={`t-eyebrow flex items-center gap-1.5 ${tone.fg}`}>
                          <tone.Icon className="h-3.5 w-3.5" />
                          {tone.label}
                        </p>
                        <p dir="auto" className="t-body-sm mt-1 text-[color:var(--content-primary)]">
                          {d.message}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {d.actionHref && (
                            <button
                              onClick={() => { setOpen(false); router.push(d.actionHref!); }}
                              className="t-caption rounded-[var(--radius-xs)] bg-[var(--surface-accent)] px-2.5 py-1 font-bold text-[color:var(--content-on-accent)]"
                            >
                              {d.action ?? "افتح"}
                            </button>
                          )}
                          {/* The point of merging: an alert you can reply to. */}
                          <button
                            onClick={() => askAbout(d)}
                            className="t-caption rounded-[var(--radius-xs)] border border-[var(--border-strong)] px-2.5 py-1 font-semibold text-[color:var(--content-secondary)] hover:bg-[var(--surface-raised)]"
                          >
                            اسأل عنه
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ChatThread />
              </div>
              <Composer />
            </>
          )}
        </aside>
      )}
    </>
  );
}
