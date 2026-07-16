"use client";

export default function EmptyState({
  icon = "📭",
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
    <div className={`flex flex-col items-center justify-center gap-3 py-12 text-center ${className}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint text-2xl text-primary">
        {icon}
      </div>
      <div>
        <p className="text-[15px] font-semibold text-ink-secondary">{title}</p>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
