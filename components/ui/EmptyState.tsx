"use client";

import type React from "react";
import { EmptyMark } from "@/components/icons";

/**
 * The five states a region can be in when it has nothing to show. They are
 * different problems and were previously one grey box, which is why a user who
 * over-filtered got told to "add your first lead".
 *
 *   first-run  — genuinely nothing exists yet. Teaches, and names one action.
 *   no-results — records exist, the filter excluded them. Offers to clear it.
 *   cleared    — nothing left *because the work is done*. This is good news.
 *   blocked    — permission. Says who can grant it.
 *   broken     — a fetch failed. Says what failed and offers a retry.
 *
 * The mark is one geometric figure derived from the logo's arc, rotated per
 * variant. One SVG, five orientations — cohesive, and nothing to commission.
 */
export type EmptyVariant = "first-run" | "no-results" | "cleared" | "blocked" | "broken";

const VARIANT: Record<EmptyVariant, { rotate: number; tone: string }> = {
  "first-run": { rotate: 0, tone: "text-[color:var(--content-accent)]" },
  "no-results": { rotate: 90, tone: "text-[color:var(--content-tertiary)]" },
  cleared: { rotate: 180, tone: "text-[color:var(--status-success-fg)]" },
  blocked: { rotate: 270, tone: "text-[color:var(--content-tertiary)]" },
  broken: { rotate: 45, tone: "text-[color:var(--status-danger-fg)]" },
};

export default function EmptyState({
  variant = "first-run",
  title,
  subtitle,
  action,
  secondaryAction,
  icon,
  className = "",
}: {
  variant?: EmptyVariant;
  title: string;
  /** One sentence. For no-results, restate the filter. For broken, what failed. */
  subtitle?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** Overrides the mark. Use only where a specific glyph says more than the mark. */
  icon?: React.ReactNode;
  className?: string;
}) {
  const v = VARIANT[variant];
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 px-6 py-14 text-center ${className}`}
      role={variant === "broken" ? "alert" : undefined}
    >
      <span className={v.tone}>{icon ?? <EmptyMark rotate={v.rotate} />}</span>
      <div className="max-w-[42ch]">
        <p className="t-title-3 text-[color:var(--content-primary)]">{title}</p>
        {subtitle && (
          <p className="t-body-sm mt-1.5 text-[color:var(--content-tertiary)]">{subtitle}</p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
