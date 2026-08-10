"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Mawrid] Unhandled error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ivory px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-red-50 text-3xl">⚠️</div>
      <div>
        <h1 className="text-xl font-bold text-ink">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-muted">
          An unexpected error occurred. You can try again — if it keeps happening, refresh the page.
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition hover:bg-primary-dark">
          Try again
        </button>
        <button onClick={() => location.reload()} className="rounded-full border border-border-light bg-[var(--surface-raised)] px-5 py-2.5 text-sm font-semibold text-ink-secondary transition hover:border-primary hover:text-primary">
          Reload page
        </button>
      </div>
    </div>
  );
}
