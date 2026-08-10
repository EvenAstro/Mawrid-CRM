"use client";

import type React from "react";
import { SparkIcon } from "@/components/icons";

/**
 * Marks model-generated content as distinct from what the CRM knows —
 * proposal 21/60, and the thing the product's credibility actually rests on.
 *
 * The divider is **typography, not colour**. Model prose sets in the display
 * face (IBM Plex Sans Arabic); CRM figures and quoted records stay in Cairo
 * with tabular figures. Two families already in the system, doing semantic
 * work instead of decorative work. A reader learns within a day that Plex
 * prose means "the model said this" — and it avoids a tinted box on every
 * screen, which is what makes AI features feel loud.
 *
 * Around it: a 2px inline-start rule in teal-300, no fill; a provenance line
 * in plain Arabic saying what the claim is based on; and confidence as a
 * three-segment meter rather than the word "medium", because a meter is
 * comparable at a glance and a word is not.
 */

export type Confidence = "high" | "medium" | "low";

const LEVEL: Record<Confidence, { filled: number; label: string }> = {
  high: { filled: 3, label: "ثقة عالية" },
  medium: { filled: 2, label: "ثقة متوسطة" },
  low: { filled: 1, label: "ثقة منخفضة" },
};

export function ConfidenceMeter({ level }: { level: Confidence }) {
  const { filled, label } = LEVEL[level];
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-[1px] ${
              i <= filled ? "bg-[var(--content-accent)]" : "bg-[var(--border-strong)]"
            }`}
            style={{ height: `${4 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="t-micro font-bold text-[color:var(--content-tertiary)]">{label}</span>
    </span>
  );
}

export default function AiBlock({
  /** What the claim rests on, in plain Arabic: "بناءً على ٤ صفقات مشابهة". */
  basis,
  confidence,
  children,
  footer,
  className = "",
}: {
  basis: string;
  confidence?: Confidence;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-s-2 border-[var(--brand-teal-300)] ps-4 ${className}`}
      aria-label="تحليل من المساعد الذكي"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="t-eyebrow flex items-center gap-1.5 text-[color:var(--content-accent)]">
          <SparkIcon className="h-3.5 w-3.5" />
          تحليل المساعد
        </span>
        {confidence && <ConfidenceMeter level={confidence} />}
      </div>

      {/* The display face is the signal. Everything inside this element is the
          model talking; anything in Cairo below it is the CRM. */}
      <div
        dir="auto"
        className="t-body-lg text-[color:var(--content-primary)]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 400 }}
      >
        {children}
      </div>

      <p className="t-caption mt-2 text-[color:var(--content-tertiary)]">{basis}</p>
      {footer && <div className="mt-3">{footer}</div>}
    </section>
  );
}

/**
 * A record the model cited, rendered as a distinct object so the claim and the
 * data behind it are visibly different things. Cairo, tabular, in a well.
 */
export function AiCitedFact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-[var(--radius-xs)] bg-[var(--surface-sunken)] px-2.5 py-1">
      <span className="t-micro text-[color:var(--content-tertiary)]">{label}</span>
      <span className="t-figure text-[13px] text-[color:var(--content-primary)]">{value}</span>
    </span>
  );
}
