"use client";

export default function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`shadow-brand rounded-[var(--radius-lg)] border border-border-light bg-[var(--surface-raised)] p-[var(--space-card-pad)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
