/**
 * Small statistics helpers shared by features that report rates back to the
 * user.
 *
 * These live here rather than inside any one feature because the thing they
 * encode — refusing to state a rate more confidently than the sample supports
 * — has to survive the feature that introduced it. The playbook was deleted;
 * this outlived it.
 */

/**
 * Wilson score interval — a 95% confidence interval on a binomial proportion.
 *
 * Far more honest than a raw percentage at small n: 3 wins out of 4 reads as
 * 75%, but its interval is roughly [30%, 95%], which correctly communicates
 * "we don't actually know yet". Show the interval, not just the point.
 */
export function wilsonInterval(successes: number, trials: number): [number, number] {
  if (trials === 0) return [0, 0];
  const z = 1.96;
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const centre = p + (z * z) / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * trials)) / trials);
  const low = Math.max(0, (centre - margin) / denom);
  const high = Math.min(1, (centre + margin) / denom);
  return [low, high];
}

/**
 * Below this many observations, a segment's own rate is not reported — the
 * caller falls back to the overall base rate and says so.
 *
 * 4 is deliberately low. It is not "enough data to be confident"; it is the
 * floor under which we don't even show a number. Anything between this and a
 * genuinely sound sample must be presented with its interval.
 */
export const MIN_SAMPLE = 4;
