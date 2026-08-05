/**
 * In-memory sliding-window rate limiter for the AI-backed API routes.
 *
 * These routes all call OpenRouter (a shared, metered budget) — without any
 * limiting, a single buggy client loop or a malicious authenticated user
 * could burn through it in seconds. This is intentionally simple (no Redis/
 * Upstash dependency): state lives in the function instance's memory, which
 * on Vercel means it resets on cold start and isn't shared across concurrent
 * instances. That makes it a *best-effort* guard, not a hard global cap —
 * good enough to stop accidental hammering (a retry loop, a stuck useEffect)
 * from one warm instance, not a substitute for a persistent store if this
 * ever needs to be airtight. Swap the Map for Upstash/Redis behind the same
 * checkRateLimit() signature if that's ever needed; call sites don't change.
 */

const buckets = new Map<string, number[]>();

/** Occasionally drop old keys so the map doesn't grow unbounded across a
 * long-lived warm instance. Cheap enough to run on every call. */
function prune(now: number, windowMs: number) {
  if (buckets.size < 500) return;
  for (const [key, hits] of buckets) {
    if (hits.every((t) => now - t > windowMs)) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying, only set when blocked. */
  retryAfterSec?: number;
}

/**
 * @param key Unique identifier for this caller + route, e.g. `${userId}:copilot`.
 * @param max Max requests allowed inside the window.
 * @param windowMs Sliding window size in milliseconds.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now, windowMs);

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const retryAfterSec = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true };
}
