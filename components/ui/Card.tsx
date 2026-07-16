"use client";

export default function Card({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border-light bg-white p-6 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
