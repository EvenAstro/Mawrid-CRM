"use client";

import type React from "react";

/**
 * One table language for every list view — proposal 58.
 *
 * Decisions encoded here, each defensible in a sentence:
 *
 *   Hairline, never zebra. Zebra fights a hairline system and doubles the
 *   visual noise at 200 rows.
 *
 *   44px rows. The previous py-4 gave 56px, which fits ~11 rows on a laptop.
 *   44px fits 15 without crowding.
 *
 *   Sticky header. At 200 rows a header that scrolls away makes every column
 *   a guess.
 *
 *   Selection is a 2px inline-start rail, not a fill. A filled selected row
 *   at 200 rows is a wall of colour.
 *
 *   Status is a rail, not a chip. 200 chips is 200 coloured rectangles.
 *
 *   Numbers align on the inline end with tabular figures, so columns of money
 *   line up as columns rather than as ragged text.
 *
 * Rows are keyboard-reachable by construction: `onRowClick` gives every row a
 * tabIndex, a role and an Enter/Space handler. Four screens previously had
 * clickable `<tr onClick>` with no keyboard path at all.
 */

export function Table({
  children,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] ${className}`}>
      <table className="w-full border-collapse" aria-label={ariaLabel}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-[var(--surface-sunken)]">
      <tr className="border-b border-[var(--border-subtle)]">{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  numeric = false,
  sort,
  onSort,
  className = "",
}: {
  children: React.ReactNode;
  numeric?: boolean;
  /** Current sort state for this column, if it is sortable. */
  sort?: "asc" | "desc" | null;
  onSort?: () => void;
  className?: string;
}) {
  const label = (
    <span className="t-eyebrow text-[color:var(--content-tertiary)]">{children}</span>
  );
  return (
    <th
      scope="col"
      aria-sort={sort ? (sort === "asc" ? "ascending" : "descending") : undefined}
      className={`px-3 py-2.5 ${numeric ? "text-end" : "text-start"} ${className}`}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 transition-colors duration-[var(--motion-fast)] hover:text-[color:var(--content-accent)]"
        >
          {label}
          <span aria-hidden="true" className="t-micro text-[color:var(--content-tertiary)]">
            {sort === "asc" ? "▲" : sort === "desc" ? "▼" : "⇅"}
          </span>
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  onRowClick,
  selected = false,
  tone,
  muted = false,
  label,
}: {
  children: React.ReactNode;
  onRowClick?: () => void;
  selected?: boolean;
  /** Semantic rail on the inline start. Only where the row's state means something. */
  tone?: "success" | "warning" | "danger";
  /** Dimmed — for rows that are present but deprioritised (junk, archived). */
  muted?: boolean;
  /** Accessible name for the row action. Required when onRowClick is set. */
  label?: string;
}) {
  /**
   * The rail is painted as an inset box-shadow, not a ::before.
   *
   * A ::before with `content: ''` on a <tr> generates an anonymous table-cell
   * even when it is absolutely positioned. That silently shifted every body
   * cell one column away from its header — the values still lined up with each
   * other, so the table looked plausible while every column was mislabelled.
   * A box-shadow paints over the row without entering the column grid.
   *
   * The offset is negative because the app is RTL throughout: in RTL the
   * inline start is the right edge. box-shadow has no logical equivalent, so
   * this is one of the few places a physical direction is correct rather than
   * lazy.
   */
  const railColor =
    tone === "success"
      ? "var(--status-success-fg)"
      : tone === "warning"
        ? "var(--status-warning-fg)"
        : tone === "danger"
          ? "var(--status-danger-fg)"
          : selected
            ? "var(--content-accent)"
            : "transparent";
  return (
    <tr
      onClick={onRowClick}
      onKeyDown={
        onRowClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRowClick();
              }
            }
          : undefined
      }
      tabIndex={onRowClick ? 0 : undefined}
      role={onRowClick ? "button" : undefined}
      aria-label={onRowClick ? label : undefined}
      style={{ boxShadow: `inset -2px 0 0 0 ${railColor}` }}
      className={`border-b border-[var(--border-subtle)] last:border-0 ${
        muted ? "opacity-55" : ""
      } ${
        onRowClick
          ? "cursor-pointer transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-hover)]"
          : ""
      } ${selected ? "bg-[var(--surface-active)]" : ""}`}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  numeric = false,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td
      onClick={onClick}
      className={`px-3 py-2.5 align-middle ${
        numeric ? "t-figure text-end" : "t-body-sm"
      } text-[color:var(--content-secondary)] ${className}`}
    >
      {children}
    </td>
  );
}

/** Ledger-margin cell: the one attribute a reader scans down the table. */
export function TDLedger({ children }: { children: React.ReactNode }) {
  return (
    <td className="t-caption px-3 py-2.5 align-middle text-[color:var(--content-tertiary)]">
      {children}
    </td>
  );
}
