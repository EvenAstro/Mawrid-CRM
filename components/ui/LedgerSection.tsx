import type React from "react";

/**
 * The ledger margin — proposal 38, and the composition device the redesign
 * rests on.
 *
 * Arabic reading enters at the right. This puts a section's scanning metadata
 * (label, count, timestamp) in a narrow right-hand column exactly where the eye
 * lands first, and keeps it out of the content plate entirely. The result is a
 * strong vertical rhythm down every page that costs nothing at runtime and that
 * a reader stops noticing by day two — which is the point, for someone who
 * lives in this product eight hours a day.
 *
 * Below 1024px the margin collapses to a label above the plate, because a
 * 140px column on a phone is not a margin, it is a squeeze.
 *
 * Uses logical properties throughout, so nothing here needs a [dir] override.
 */
export default function LedgerSection({
  label,
  meta,
  aside,
  children,
  className = "",
  as: Tag = "section",
}: {
  /** The section's name. Set in the eyebrow style — short, no punctuation. */
  label: string;
  /** A count, total or period. Anything a reader scans rather than reads. */
  meta?: React.ReactNode;
  /** Rare: an action that belongs to the section rather than the page. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={`flex flex-col gap-3 lg:flex-row lg:gap-6 ${className}`}>
      <div className="flex flex-none items-baseline gap-3 lg:w-[140px] lg:flex-col lg:items-start lg:gap-1.5 lg:border-e lg:border-[var(--border-subtle)] lg:pe-4">
        <span className="t-eyebrow text-[color:var(--content-tertiary)]">{label}</span>
        {meta && (
          <span className="t-caption tabular-nums text-[color:var(--content-tertiary)]">{meta}</span>
        )}
        {aside && <div className="ms-auto lg:ms-0 lg:mt-1">{aside}</div>}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </Tag>
  );
}
