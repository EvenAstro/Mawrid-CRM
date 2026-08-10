import type React from "react";

/**
 * Meridian surface primitives.
 *
 * These exist so card chrome is defined once instead of being re-typed as a
 * long class string on every screen — which is how the six different card
 * borders and five different corner radii in the previous build happened.
 *
 * Two elevation levels, hairline borders, radius-lg. No accent stripe: colour
 * on a panel edge should mean something, and a different hue per card means
 * nothing.
 */

export function Panel({
  children,
  className = "",
  interactive = false,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Adds the hover lift. Only for panels that are themselves a link or button. */
  interactive?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={`rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] e-1 ${
        interactive
          ? "transition-shadow duration-[var(--motion-base)] ease-[var(--ease-standard)] hover:e-2"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

/**
 * Panel header. The icon sits in a quiet neutral well rather than a coloured
 * one — in the previous build every card had its own hue, which made the
 * dashboard read as a chart of colours instead of a chart of numbers.
 */
export function PanelHead({
  icon,
  title,
  subtitle,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] text-[color:var(--content-accent)]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="t-title-3 truncate text-[color:var(--content-primary)]">{title}</h2>
          {subtitle && (
            <p className="t-caption mt-0.5 truncate text-[color:var(--content-tertiary)]">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}

/**
 * The navy command band that opens every app screen. This is the load-bearing
 * piece of Meridian: navy as structural material framing the ivory work
 * surface below, rather than navy as a decorative header.
 *
 * `footer` renders inside the band, under a hairline — that is where the KPI
 * row lives on the dashboard, so the figures read as part of the dark
 * structure instead of floating as four more white cards.
 */
export function CommandBand({
  icon,
  title,
  subtitle,
  actions,
  footer,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-inverse)]">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-6 py-6">
        <div className="flex min-w-0 items-center gap-4">
          {icon && (
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[var(--radius-md)] bg-white/[0.07] text-[color:var(--content-inverse-accent)]">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 dir="auto" className="t-title-fluid text-[color:var(--content-inverse-primary)]">
              {title}
            </h1>
            {subtitle && (
              <div className="t-body-sm mt-1 text-[color:var(--content-inverse-tertiary)]">{subtitle}</div>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {footer && <div className="border-t border-[var(--border-inverse)]">{footer}</div>}
    </section>
  );
}

/** Primary action, on navy. */
export function BandButton({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 rounded-[var(--radius-md)] px-5 text-[length:var(--text-body-sm)] font-bold transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] disabled:cursor-not-allowed disabled:opacity-40 ${
        variant === "primary"
          ? "bg-[var(--brand-teal-400)] text-white hover:bg-[var(--brand-teal-300)] hover:text-[color:var(--surface-inverse)]"
          : "border border-[var(--border-inverse-strong)] text-[color:var(--content-inverse-secondary)] hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A sunken group inside a panel — proposal 39. Previously these were built as
 * a fourth card, which is how panels ended up nesting three deep on Insights.
 * No border and no shadow: a well is a recess, not a raised thing.
 */
export function Well({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] p-[var(--space-card-compact)] ${className}`}>
      {children}
    </div>
  );
}

/**
 * The navy counterpart to Panel — for dense figures that should read as
 * instrumentation rather than as content. Used sparingly: at most one per
 * screen below the command band, or navy stops meaning anything.
 */
export function DataPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[var(--radius-lg)] bg-[var(--surface-inverse)] p-[var(--space-card-pad)] e-inverse-1 ${className}`}>
      {children}
    </div>
  );
}
