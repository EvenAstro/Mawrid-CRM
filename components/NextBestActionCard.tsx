"use client";

import { useCallback, useEffect, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { createActivity } from "@/lib/models/activities";

// Module-level: survives panel open/close within a session, resets on full page
// reload — matching "dismiss for this session only, cleared on next page load".
const dismissedThisSession = new Set<string>();

interface Recommendation {
  action: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  confidence: "high" | "medium" | "low";
  matchTier: "exact" | "stage" | "tag" | "none";
}
interface NextBestActionResponse {
  dealId: string;
  recommendation: Recommendation | null;
  activityCount: number;
  generatedAt: string | null;
  matchTier: string;
  cached?: boolean;
}

const URGENCY_DOT: Record<Recommendation["urgency"], string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-primary",
};
const URGENCY_LABEL_AR: Record<Recommendation["urgency"], string> = {
  high: "عاجل",
  medium: "متوسط",
  low: "منخفض",
};
const CONFIDENCE_LABEL_AR: Record<Recommendation["confidence"], string> = {
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

function SparkleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8c0 2.2-1.8 4-4 4 2.2 0 4 1.8 4 4 0-2.2 1.8-4 4-4-2.2 0-4-1.8-4-4Z" />
    </svg>
  );
}

function RefreshIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/** Shared shell for the AI-insight visual treatment — a soft teal-tinted gradient card, distinct from plain white info cards. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-primary/15 bg-gradient-to-br from-mint/60 via-white to-white p-5 shadow-brand">
      {children}
    </div>
  );
}

function HeaderRow({ onRefresh, refreshing }: { onRefresh?: () => void; refreshing?: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="flex items-center gap-1.5 t-micro font-semibold uppercase tracking-[0.1em] text-primary/70">
        <SparkleIcon className="h-3.5 w-3.5" />
        أفضل إجراء تالٍ
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="تحديث التوصية"
          className="rounded-full p-1.5 text-muted/50 opacity-60 transition hover:bg-[var(--surface-raised)] hover:text-primary hover:opacity-100 disabled:opacity-40"
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      )}
    </div>
  );
}

export default function NextBestActionCard({
  dealId,
  entityType = "deal",
  hideWhenEmpty = false,
}: {
  dealId: string;
  /** Whether the id refers to a deal or a lead (affects the "done" activity log). */
  entityType?: "deal" | "lead";
  /** When true, render nothing at all if the entity has no activity yet. */
  hideWhenEmpty?: boolean;
}) {
  const toast = useToast();
  const [data, setData] = useState<NextBestActionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => dismissedThisSession.has(dealId));
  const [executing, setExecuting] = useState(false);

  const load = useCallback(
    async (force: boolean) => {
      if (force) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`/api/next-best-action${force ? "?force=true" : ""}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ dealId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load recommendation");
        }
        const json = (await res.json()) as NextBestActionResponse;
        setData(json);
      } catch (err) {
        console.error("[NextBestActionCard] load failed", err);
        setError(err instanceof Error ? err.message : "Failed to load recommendation");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dealId],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const dismiss = useCallback(() => {
    dismissedThisSession.add(dealId);
    setDismissed(true);
  }, [dealId]);

  const markDone = useCallback(async () => {
    const action = data?.recommendation?.action;
    if (!action) return;
    setExecuting(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: insertErr } = await createActivity({
      entityType,
      entityId: dealId,
      body: `تم تنفيذ التوصية: ${action}`,
      direction: "outbound",
      occurredAt: new Date().toISOString(),
      userId: userData.user?.id ?? null,
    });
    setExecuting(false);
    if (insertErr) {
      console.error("[NextBestActionCard] mark-done insert failed", insertErr);
      toast("تعذّر تسجيل الإجراء", "error");
      return;
    }
    toast("تم تسجيل تنفيذ التوصية");
    load(true); // new activity → regenerate on fresh data
  }, [data, dealId, entityType, toast, load]);

  // Dismissed for this session — minimal placeholder.
  if (dismissed) {
    return (
      <Shell>
        <p dir="auto" className="t-body-sm text-muted">
          يمكنك إعادة التحميل لاحقاً
        </p>
      </Shell>
    );
  }

  // Loading — shimmer sized to roughly match the resolved card, to avoid layout jump.
  if (loading) {
    return (
      <Shell>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <Skeleton className="mb-2 h-5 w-4/5" />
        <Skeleton className="mb-1 h-3.5 w-full" />
        <Skeleton className="mb-3 h-3.5 w-2/3" />
        <Skeleton className="h-3 w-20" />
      </Shell>
    );
  }

  // Error — quiet fallback, not an alarming error box.
  if (error) {
    return (
      <Shell>
        <HeaderRow />
        <p dir="auto" className="text-[14px] font-medium text-ink-secondary">
          التوصية غير متاحة حالياً
        </p>
        <button onClick={() => load(false)} className="mt-2 t-caption font-semibold text-primary hover:underline">
          إعادة المحاولة
        </button>
      </Shell>
    );
  }

  if (!data) return null;

  // Empty — deal has no activity yet, don't force a recommendation out of nothing.
  if (data.activityCount === 0 || !data.recommendation) {
    if (hideWhenEmpty) return null;
    return (
      <Shell>
        <HeaderRow onRefresh={() => load(true)} refreshing={refreshing} />
        <p dir="auto" className="text-[14px] text-muted">
          لا توجد بيانات كافية بعد
        </p>
      </Shell>
    );
  }

  const rec = data.recommendation;
  const isLooseMatch = rec.matchTier === "tag" || rec.matchTier === "none";

  return (
    <Shell>
      <HeaderRow onRefresh={() => load(true)} refreshing={refreshing} />

      <p dir="auto" className="t-body-lg font-extrabold leading-snug tracking-tight text-ink">
        {rec.action}
      </p>
      <p dir="auto" className="mt-1.5 line-clamp-2 t-body-sm leading-relaxed text-muted">
        {rec.reason}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 t-caption font-medium text-ink-secondary">
          <span className={`h-1.5 w-1.5 flex-none rounded-full ${URGENCY_DOT[rec.urgency]}`} />
          {URGENCY_LABEL_AR[rec.urgency]}
        </span>
        <span className="t-micro text-muted/80">الثقة: {CONFIDENCE_LABEL_AR[rec.confidence]}</span>
      </div>

      {isLooseMatch && (
        <p dir="auto" className="mt-2.5 t-micro text-muted/70">
          بناءً على بيانات محدودة
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-primary/10 pt-3">
        <button
          onClick={markDone}
          disabled={executing}
          className="rounded-full px-3 py-1.5 t-caption font-semibold text-primary transition hover:bg-mint disabled:opacity-50"
        >
          {executing ? "…" : "✓ تم التنفيذ"}
        </button>
        <button
          onClick={dismiss}
          className="rounded-full px-3 py-1.5 t-caption font-semibold text-muted transition hover:bg-black/[0.03] hover:text-ink-secondary"
        >
          تجاهل
        </button>
      </div>
    </Shell>
  );
}
