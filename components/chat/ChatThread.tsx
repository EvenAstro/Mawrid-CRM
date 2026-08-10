"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatTime, dayHeader, initials } from "@/lib/format";
import { groupMessages, isPending } from "@/lib/chat/grouping";
import type { MessageRow } from "@/lib/models/messages";
import type { LiveStatus } from "@/lib/chat/useConversation";
import EmptyState from "@/components/ui/EmptyState";
import { AlertIcon } from "@/components/icons";

/**
 * The message thread.
 *
 * No bubbles. Meridian is a disciplined direction and opposed coloured
 * bubbles break it immediately — they also break the reading column, which is
 * what makes a long thread slow to scan. Instead this uses the same language
 * as the activity timeline and the loss report: the timestamp and sender sit
 * in the ledger margin on the reading-entry side, the text sits in the plate.
 *
 * My own messages get a quiet accent-tinted plate and nothing else. That is
 * enough to tell them apart at a glance without mirroring the layout.
 */
export default function ChatThread({
  messages,
  meId,
  nameOf,
  loading,
  error,
  status,
  hasMore,
  failedIds,
  onRetry,
  onLoadOlder,
  onReload,
}: {
  messages: MessageRow[];
  meId: string;
  nameOf: (userId: string) => string;
  loading: boolean;
  error: boolean;
  status: LiveStatus;
  hasMore: boolean;
  failedIds: Set<string>;
  onRetry: (id: string) => void;
  onLoadOlder: () => void;
  onReload: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const [unseen, setUnseen] = useState(0);

  // Only auto-scroll when the reader is already at the bottom. Yanking the
  // view while someone is reading an older message is the single most
  // annoying thing a chat does.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pinned) {
      el.scrollTop = el.scrollHeight;
      setUnseen(0);
    } else {
      setUnseen((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      setPinned(atBottom);
      if (atBottom) setUnseen(0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setPinned(true);
    setUnseen(0);
  }

  if (error) {
    return (
      <EmptyState
        variant="broken"
        title="تعذّر تحميل الرسائل"
        subtitle="ما وصلنا للخادم. تحقق من اتصالك وحاول مرة ثانية."
        action={
          <button
            onClick={onReload}
            className="t-body-sm rounded-[var(--radius-md)] bg-[var(--surface-accent)] px-5 py-2.5 font-semibold text-[color:var(--content-on-accent)] transition-colors hover:bg-[var(--surface-accent-hover)]"
          >
            إعادة المحاولة
          </button>
        }
      />
    );
  }

  if (loading && messages.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <span className="skeleton-shimmer h-3 w-24 flex-none rounded-[var(--radius-xs)]" />
            <span className="skeleton-shimmer h-3 flex-1 rounded-[var(--radius-xs)]" style={{ maxWidth: `${70 - i * 8}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        variant="first-run"
        title="ما فيه رسائل بعد"
        subtitle="اكتب أول رسالة في الأسفل — الطرف الآخر يشوفها فوراً."
      />
    );
  }

  const groups = groupMessages(messages);
  // Which groups open a new day. Computed up front so the render pass has no
  // mutable state of its own.
  const startsDay = groups.map((g, i) => i === 0 || groups[i - 1].dayKey !== g.dayKey);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {status === "offline" && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-2"
        >
          <AlertIcon className="h-3.5 w-3.5 flex-none text-[color:var(--status-warning-fg)]" />
          <p className="t-caption text-[color:var(--status-warning-fg)]">
            انقطع الاتصال المباشر — يُعاد التحميل كل ٣٠ ثانية.
          </p>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {hasMore && (
          <button
            onClick={onLoadOlder}
            className="t-caption mx-auto mb-4 block rounded-full border border-[var(--border-subtle)] px-4 py-1.5 font-semibold text-[color:var(--content-tertiary)] transition-colors hover:bg-[var(--surface-hover)]"
          >
            تحميل رسائل أقدم
          </button>
        )}

        {groups.map((g, gi) => {
          const showDay = startsDay[gi];
          const mine = g.senderId === meId;
          const first = g.messages[0];
          return (
            <div key={`${g.dayKey}-${g.senderId}-${gi}`}>
              {showDay && (
                <p className="t-eyebrow my-4 text-center text-[color:var(--content-tertiary)]">
                  {dayHeader(first.created_at)}
                </p>
              )}
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
                {/* Ledger margin: who and when, on the reading-entry side. */}
                <div className="flex flex-none items-baseline gap-2 sm:w-[132px] sm:flex-col sm:items-start sm:gap-0.5">
                  <span className="t-caption font-bold text-[color:var(--content-secondary)]">
                    {mine ? "أنت" : nameOf(g.senderId)}
                  </span>
                  <span dir="ltr" className="t-micro tabular-nums text-[color:var(--content-tertiary)]">
                    {formatTime(first.created_at)}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {g.messages.map((m) => {
                    const failed = failedIds.has(m.id);
                    const sending = isPending(m) && !failed;
                    return (
                      <div key={m.id} className="flex flex-col gap-1">
                        <p
                          dir="auto"
                          className={`t-body-sm whitespace-pre-wrap break-words rounded-[var(--radius-sm)] px-3 py-2 ${
                            mine
                              ? "bg-[var(--surface-accent-subtle)] text-[color:var(--content-primary)]"
                              : "text-[color:var(--content-secondary)]"
                          } ${sending ? "opacity-60" : ""} ${failed ? "opacity-70" : ""}`}
                        >
                          {m.body}
                        </p>
                        {failed && (
                          <span className="t-micro flex items-center gap-2 px-3 text-[color:var(--status-danger-fg)]">
                            فشل الإرسال
                            <button
                              onClick={() => onRetry(m.id)}
                              className="font-bold underline underline-offset-2"
                            >
                              إعادة
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {unseen > 0 && !pinned && (
        <button
          onClick={jumpToBottom}
          className="t-caption absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-[var(--surface-inverse)] px-4 py-2 font-bold text-[color:var(--content-inverse-primary)] e-overlay"
        >
          {unseen === 1 ? "رسالة جديدة" : `${unseen} رسائل جديدة`} ↓
        </button>
      )}
    </div>
  );
}

/** Small round avatar used by the conversation list. */
export function Avatar({ name, className = "h-9 w-9" }: { name: string; className?: string }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full bg-[var(--surface-inverse)] ${className}`}
      aria-hidden="true"
    >
      <span className="t-micro font-bold text-[color:var(--content-inverse-primary)]">
        {initials(name)}
      </span>
    </span>
  );
}
