"use client";

import type React from "react";
import { AlertIcon, SparkIcon } from "@/components/icons";

/**
 * One failure, pending and rate-limit contract for every AI surface —
 * proposal 22.
 *
 * Before this, HTTP 429 was handled in exactly one place out of six. The other
 * five routes returned a `Retry-After` header that no UI read, so a
 * rate-limited Playbook or Revenue tab showed a generic failure and the user
 * had no idea that waiting would fix it.
 *
 * The shape here generalises what the investigation report already did right:
 * when the model doesn't answer, fall back to the data the CRM already has
 * rather than blanking the region. An AI feature failing should cost the user
 * the *insight*, never the *record*.
 */

export type AiFailureKind = "rate_limited" | "unavailable" | "unauthorized" | "invalid";

export interface AiFailure {
  kind: AiFailureKind;
  /** Seconds to wait, when the server sent Retry-After. */
  retryAfterSec?: number;
}

/** Reads a failed AI response into the shared shape, including Retry-After. */
export async function readAiFailure(res: Response): Promise<AiFailure> {
  if (res.status === 429) {
    const header = Number(res.headers.get("Retry-After"));
    return {
      kind: "rate_limited",
      retryAfterSec: Number.isFinite(header) && header > 0 ? header : undefined,
    };
  }
  if (res.status === 401 || res.status === 403) return { kind: "unauthorized" };
  if (res.status >= 500) return { kind: "unavailable" };
  return { kind: "invalid" };
}

const COPY: Record<AiFailureKind, { title: string; body: string }> = {
  rate_limited: {
    title: "تجاوزت حد الطلبات مؤقتاً",
    body: "المساعد يقبل عدداً محدوداً من الطلبات في الدقيقة.",
  },
  unavailable: {
    title: "المساعد غير متاح الآن",
    body: "الخدمة ما ردّت. البيانات تحت من النظام مباشرة وما تأثرت.",
  },
  unauthorized: {
    title: "ما عندك صلاحية لهذا التحليل",
    body: "راجع مديرك لفتح الصلاحية.",
  },
  invalid: {
    title: "تعذّر قراءة رد المساعد",
    body: "البيانات تحت من النظام مباشرة وما تأثرت.",
  },
};

/**
 * Shown in place of AI output when the model didn't answer. `children` is the
 * raw CRM data — always render it, so the region still says something true.
 */
export function AiFailureNotice({
  failure,
  onRetry,
  children,
}: {
  failure: AiFailure;
  onRetry?: () => void;
  children?: React.ReactNode;
}) {
  const copy = COPY[failure.kind];
  const wait =
    failure.kind === "rate_limited" && failure.retryAfterSec
      ? ` جرّب بعد ${failure.retryAfterSec} ثانية.`
      : "";
  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        className="flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-[var(--radius-md)] border-s-2 border-[var(--status-warning-fg)] bg-[var(--status-warning-bg)] px-4 py-3"
      >
        <AlertIcon className="mt-0.5 h-4 w-4 flex-none text-[color:var(--status-warning-fg)]" />
        <div className="min-w-0 flex-1">
          <p className="t-body-sm font-bold text-[color:var(--status-warning-fg)]">{copy.title}</p>
          <p className="t-caption mt-0.5 text-[color:var(--status-warning-fg)]">
            {copy.body}
            {wait}
          </p>
        </div>
        {onRetry && failure.kind !== "unauthorized" && (
          <button
            onClick={onRetry}
            className="t-caption flex-none rounded-[var(--radius-xs)] border border-[var(--status-warning-border)] px-2.5 py-1 font-bold text-[color:var(--status-warning-fg)] transition-colors hover:bg-[var(--status-warning-border)]"
          >
            إعادة المحاولة
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Pending state for an AI region: a skeleton in the block's own shape, never a
 * spinner laid over content. A spinner on top of stale numbers makes the user
 * doubt numbers that are still correct.
 */
export function AiPending({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="جارِ التحليل">
      <span className="t-eyebrow flex items-center gap-1.5 text-[color:var(--content-accent)]">
        <SparkIcon className="h-3.5 w-3.5" />
        جارِ التحليل
      </span>
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            className="skeleton-shimmer block h-3 rounded-[var(--radius-xs)]"
            style={{ width: `${100 - i * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}
