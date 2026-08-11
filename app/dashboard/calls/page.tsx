"use client";

import CallQueue from "@/components/calls/CallQueue";

/**
 * مكالماتك — the rep's morning, as one screen.
 *
 * Deliberately not a dashboard. There is no summary at the top and no chart:
 * a rep opens this to do the next thing, and every pixel that is not the next
 * thing is in the way.
 */
export default function CallsPage() {
  return (
    <div className="flex flex-col gap-8 p-4 md:p-6">
      <header>
        <h1 className="t-title-1 text-[color:var(--content-primary)]">مكالماتك</h1>
        <p className="t-body-sm mt-1 text-[color:var(--content-tertiary)]">
          مرتّبة بالأولوية — اتصل، وسجّل بضغطة وأنت راجع
        </p>
      </header>
      <CallQueue />
    </div>
  );
}
