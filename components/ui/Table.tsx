"use client";

import React, { useEffect, useRef } from "react";

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

/**
 * Dev-only column alignment check.
 *
 * A table whose body cells are offset from their headers renders perfectly:
 * the values still line up with each other, the numbers are still right, and
 * every column is labelled with its neighbour's name. TypeScript can't see it,
 * ESLint can't see it, and a build passes. The only way to catch it is to
 * measure the rendered geometry, so that's what this does.
 *
 * It found a real one: a ::before rail on <tr> generated an anonymous
 * table-cell, shifting every body cell one column. That shipped through every
 * gate we have.
 *
 * Stripped from production builds — the whole effect body is behind a
 * NODE_ENV check that bundlers eliminate.
 */
function useColumnAlignmentCheck(
  ref: React.RefObject<HTMLTableElement | null>,
  ariaLabel: string,
) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const table = ref.current;
    if (!table) return;

    // Wait a frame — column widths are not final until layout has run.
    const id = requestAnimationFrame(() => {
      const ths = [...table.querySelectorAll<HTMLElement>("thead th")];
      const firstRow = table.querySelector("tbody tr");
      if (!ths.length || !firstRow) return;
      const tds = [...firstRow.querySelectorAll<HTMLElement>("td")];
      if (!tds.length) return;

      if (ths.length !== tds.length) {
        console.error(
          `[Table:"${ariaLabel}"] column count mismatch — ${ths.length} header cells, ${tds.length} body cells. ` +
            `Every column after the first difference is labelled with the wrong header.`,
        );
        return;
      }

      for (let i = 0; i < ths.length; i++) {
        const h = Math.round(ths[i].getBoundingClientRect().x);
        const b = Math.round(tds[i].getBoundingClientRect().x);
        // 1px of tolerance for sub-pixel layout, no more — a genuine
        // off-by-one-column is off by the width of a column.
        if (Math.abs(h - b) > 1) {
          console.error(
            `[Table:"${ariaLabel}"] column ${i} is misaligned: header "${ths[i].innerText.trim()}" ` +
              `at x=${h}, body cell "${tds[i].innerText.trim().split("\n")[0]}" at x=${b}. ` +
              `The table will look correct while every column carries the wrong header. ` +
              `Usual cause: a ::before/::after with content on <tr>, which generates an anonymous table-cell.`,
          );
          return; // one report is enough; the rest are the same shift
        }
      }
    });
    return () => cancelAnimationFrame(id);
  });
}

export function Table({
  children,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTableElement>(null);
  useColumnAlignmentCheck(ref, ariaLabel);
  return (
    <div className={`overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] ${className}`}>
      <table ref={ref} className="w-full border-collapse" aria-label={ariaLabel}>
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
