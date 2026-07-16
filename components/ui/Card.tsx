"use client";

export default function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`shadow-brand rounded-2xl border border-border-light bg-white p-6 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
