"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number when it *changes*, and only then.
 *
 * The previous version counted up from zero on mount, which is an entrance
 * animation — and under the Meridian motion rule dashboard content does not
 * animate in. It was also actively unhelpful: these figures sit behind a
 * Supabase round trip, so the count-up ran *after* the user had already
 * waited, delaying the number they were waiting for.
 *
 * Animating a genuine change is different, and worth keeping: when a figure
 * updates after a reload, the movement tells the user which number moved. That
 * is information, not decoration.
 *
 * First paint is therefore instant. Reduced motion skips the tween entirely.
 */
export default function CountUp({
  value,
  duration = 400,
  format = (n: number) => String(n),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  // Seeded with the real value, so the first render is the final number.
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
